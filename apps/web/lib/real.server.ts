// Real data layer — computes every dashboard payload from the actual delegate
// roster (Supabase/file) and hierarchy. No synthesized/mock numbers. Call-activity
// metrics are zero until the field operation ticks sheets and the sync fills
// call_records; they then populate here. Server-only.
import { REAL_HIERARCHY } from "./hierarchy";
import {
  getAllDelegates,
  getCallStats,
  getCallActivity,
  getCallbacks,
  getCallerStats,
  getCallerDirectory,
  getRealDelegates,
  getRosterCounts,
  getRosterGroups,
  rosterKey,
  type CallStat,
  type CallActivity,
} from "./delegates.server";
import { addSpines, classify, projectShare } from "./analytics";
import { getConfig, type CampaignConfig } from "./config.server";
import { getViewerScope, scopeHierarchy } from "./scope.server";
import type {
  Classification,
  AnalyticsPayload,
  CallerPerf,
  Conflict,
  ConstituencyPayload,
  ConstituencyRollup,
  DailyReached,
  Kpis,
  OverviewPayload,
  RegionPayload,
  RegionRollup,
  SegmentEngagement,
  Spine,
  SyncOverview,
} from "./types";

const EMPTY_SPINE: Spine = { supportive: 0, undecided: 0, opposed: 0, notReached: 0 };

// Derive a support spine from logged calls; unreached delegates fill notReached.
function spineFrom(delegates: number, st: CallStat | undefined): Spine {
  const supportive = st?.supportive ?? 0;
  const undecided = st?.undecided ?? 0;
  const opposed = st?.opposed ?? 0;
  return { supportive, undecided, opposed, notReached: Math.max(0, delegates - supportive - undecided - opposed) };
}
function kpisFrom(delegates: number, st: CallStat | undefined): Kpis {
  const called = st?.called ?? 0;
  const reached = st?.reached ?? 0;
  return { delegates, called, reached, coverage: delegates ? called / delegates : 0 };
}
function classFrom(spine: Spine, reached: number, cfg: CampaignConfig): Classification {
  return reached === 0 ? "unrated" : classify(projectShare(spine, cfg.weights), cfg.thresholds);
}
function aggregate(items: { kpis: Kpis; spine: Spine }[]): { kpis: Kpis; spine: Spine } {
  const spine = items.reduce((acc, i) => addSpines(acc, i.spine), EMPTY_SPINE);
  const delegates = items.reduce((s, i) => s + i.kpis.delegates, 0);
  const called = items.reduce((s, i) => s + i.kpis.called, 0);
  const reached = items.reduce((s, i) => s + i.kpis.reached, 0);
  return { spine, kpis: { delegates, called, reached, coverage: delegates ? called / delegates : 0 } };
}

async function build() {
  const [counts, stats, scope, callerDir, cfg] = await Promise.all([
    getRosterCounts(),
    getCallStats(),
    getViewerScope(),
    getCallerDirectory(),
    getConfig(),
  ]);
  const regions = scopeHierarchy(REAL_HIERARCHY, scope).map((r) => {
    const constituencies: ConstituencyRollup[] = r.constituencies.map((c) => {
      const key = rosterKey(r.name, c.name);
      const delegates = counts[key] ?? 0;
      const st = stats[key];
      const spine = spineFrom(delegates, st);
      const kpis = kpisFrom(delegates, st);
      return {
        id: `c-${c.code}`,
        regionId: `r-${r.code}`,
        name: c.name,
        code: c.code,
        kpis,
        spine,
        callersAssigned: (callerDir[key] ?? []).length,
        targetContacts: cfg.targetContacts,
        classification: classFrom(spine, kpis.reached, cfg),
        status: delegates === 0 ? ("no_callers" as const) : ("ok" as const),
      };
    });
    const agg = aggregate(constituencies);
    const rollup: RegionRollup = {
      id: `r-${r.code}`,
      name: r.name,
      code: r.code,
      kpis: agg.kpis,
      spine: agg.spine,
      constituencies: r.constituencies.length,
      classification: classFrom(agg.spine, agg.kpis.reached, cfg),
    };
    return { rollup, constituencies };
  });
  return regions;
}

// Reached-per-day for the last 14 days, from call_records timestamps.
function dailyReachedFrom(activity: CallActivity[]): DailyReached[] {
  const byDay: Record<string, number> = {};
  for (const a of activity) {
    if (!a.reached || !a.updatedAt) continue;
    const day = a.updatedAt.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const out: DailyReached[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, reached: byDay[key] ?? 0 });
  }
  return out;
}

// Week-over-week movement (percentage points) from the recent call activity.
function trendsFrom(activity: CallActivity[], delegates: number, reached: number) {
  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;
  const last7 = (a: CallActivity) => a.updatedAt && now - Date.parse(a.updatedAt) <= WEEK;
  const calledLast7 = activity.filter((a) => a.called && last7(a)).length;
  const reachedLast7 = activity.filter((a) => a.reached && last7(a)).length;
  const supportiveLast7 = activity.filter((a) => a.outcome === "supportive" && last7(a)).length;
  const pp = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  return {
    coverage: pp(calledLast7, delegates),
    reached: pp(reachedLast7, delegates),
    support: pp(supportiveLast7, reached),
    delegates: 0,
  };
}

// "just now" / "5m ago" / "3h ago" / "2d ago" from an ISO timestamp.
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function segments(activity?: CallActivity[]): Promise<SegmentEngagement[]> {
  const [all, act] = await Promise.all([getAllDelegates(), activity ? Promise.resolve(activity) : getCallActivity()]);
  const total = (re: RegExp) => all.filter((d) => re.test(d.position)).length;
  const reached = (re: RegExp) => act.filter((a) => a.reached && a.position && re.test(a.position)).length;
  const seg = (segment: SegmentEngagement["segment"], label: string, re: RegExp) => ({ segment, label, total: total(re), reached: reached(re) });
  return [
    seg("current_exec", "Chairmen & Vice", /chair/i),
    seg("former_exec", "Secretaries", /secretary/i),
    seg("aspiring_exec", "Organizers", /organi/i),
    seg("influencer", "Treasurers & Comms", /treasurer|communication/i),
  ];
}

export async function overview(): Promise<OverviewPayload> {
  const [regions, activity, cfg] = await Promise.all([build(), getCallActivity(), getConfig()]);
  const allCons = regions.flatMap((r) => r.constituencies);
  const national = aggregate(allCons);
  const delegates = national.kpis.delegates;
  const reached = national.kpis.reached;
  const withRoster = allCons.filter((c) => c.kpis.delegates > 0).length;
  const totalCons = regions.reduce((s, r) => s + r.constituencies.length, 0);
  const noRoster = totalCons - withRoster;
  const daysLeft = cfg.targetDays;
  const dailyReached = dailyReachedFrom(activity);
  const reachedPerDay = Math.round(dailyReached.reduce((s, d) => s + d.reached, 0) / dailyReached.length);
  const requiredPerDay = Math.ceil(Math.max(0, delegates - reached) / daysLeft);

  return {
    kpis: national.kpis,
    spine: national.spine,
    dailyReached,
    alerts: [
      ...(reached === 0
        ? [{ id: "calls", kind: "stale_data" as const, severity: "info" as const, message: "Field calls not started — metrics populate as callers log outcomes", scope: "National" }]
        : []),
      ...(noRoster > 0
        ? [{ id: "roster", kind: "no_callers" as const, severity: "warn" as const, message: `${noRoster} constituencies have no roster loaded yet`, scope: "National" }]
        : []),
    ],
    regions: regions.map((r) => r.rollup),
    segments: await segments(activity),
    syncHealth: { lastSyncMins: -1, sheetsSynced: 0, sheetsTotal: totalCons, conflictsOpen: 0, staleSheets: 0 },
    paceToTarget: {
      reachedToTarget: delegates ? reached / delegates : 0,
      target: delegates,
      daysLeft,
      reachedPerDay,
      requiredPerDay,
      onPace: reachedPerDay >= requiredPerDay && reached > 0,
    },
    trends: trendsFrom(activity, delegates, reached),
  };
}

export async function regions(): Promise<RegionRollup[]> {
  return (await build()).map((r) => r.rollup);
}

export async function region(id: string): Promise<RegionPayload | null> {
  const built = await build();
  const found = built.find((r) => r.rollup.id === id);
  if (!found) return null;
  return { region: found.rollup, spine: found.rollup.spine, segments: await segments(), constituencies: found.constituencies };
}

export async function constituency(id: string): Promise<ConstituencyPayload | null> {
  const built = await build();
  let rollup: ConstituencyRollup | undefined;
  let regionName = "";
  for (const r of built) {
    const c = r.constituencies.find((x) => x.id === id);
    if (c) {
      rollup = c;
      regionName = r.rollup.name;
      break;
    }
  }
  if (!rollup) return null;
  const roster = await getRealDelegates(regionName, rollup.name);
  // Real roster maps onto the delegate-table shape; outcomes are empty (no calls).
  const delegates = roster.map((d, i) => ({
    id: `${id}-d${i}`,
    externalRef: `${rollup!.code}-${String(i + 1).padStart(3, "0")}`,
    name: d.name,
    branch: "—",
    phone: d.contact ?? "—",
    type: d.position,
    caller: null,
    called: false,
    reached: false,
    outcome: null,
    isInfluencer: /chair|secretary/i.test(d.position),
    hasConflict: false,
  }));

  // Caller board: who is assigned to this constituency + their logged activity.
  const [dir, callerStats, allCallbacks] = await Promise.all([
    getCallerDirectory(),
    getCallerStats(),
    getCallbacks(),
  ]);
  const statByName = new Map(
    callerStats.filter((s) => s.constituency === rollup!.name).map((s) => [s.label, s]),
  );
  const callers = (dir[rosterKey(regionName, rollup.name)] ?? []).map((name) => {
    const st = statByName.get(name);
    return {
      label: name,
      attempts: st?.attempts ?? 0,
      reached: st?.reached ?? 0,
      assigned: roster.length,
      lastActive: st?.lastAt ? relativeTime(st.lastAt) : "not started",
    };
  });

  // Callbacks scheduled for this constituency.
  const callbacks = allCallbacks
    .filter((c) => c.constituency === rollup!.name)
    .map((c, i) => ({
      delegateId: `${id}-cb${i}`,
      name: c.name,
      branch: "—",
      callbackAt: new Date(c.callbackAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      caller: c.caller ?? "—",
    }));

  return { constituency: rollup, spine: rollup.spine, branches: [], callbacks, callers, delegates };
}

export async function analytics(): Promise<AnalyticsPayload> {
  const [regs, activity] = await Promise.all([build(), getCallActivity()]);
  const cons = regs.flatMap((r) => r.constituencies);
  const national = aggregate(cons);
  const priority = cons
    .filter((c) => c.kpis.delegates > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      region: regs.find((r) => r.rollup.id === c.regionId)?.rollup.name ?? "",
      delegates: c.kpis.delegates,
      coverage: c.kpis.coverage,
      gap: Math.round(c.kpis.delegates * (1 - c.kpis.coverage)),
      classification: c.classification,
    }))
    // Priority = many delegates still uncovered (high gap), then low coverage.
    .sort((a, b) => b.gap - a.gap || a.coverage - b.coverage)
    .slice(0, 8);

  const classDistribution = (["stronghold", "lean", "tossup", "weak", "unrated"] as Classification[])
    .map((classification) => ({
      classification,
      count: cons.filter((c) => c.kpis.delegates > 0 && c.classification === classification).length,
    }))
    .filter((d) => d.count > 0);

  return {
    kpis: national.kpis,
    spine: national.spine,
    funnel: [
      { stage: "Delegates", value: national.kpis.delegates },
      { stage: "Called", value: national.kpis.called },
      { stage: "Reached", value: national.kpis.reached },
      { stage: "Supportive", value: national.spine.supportive },
    ],
    regions: regs.map((r) => ({ name: r.rollup.name, code: r.rollup.code, coverage: r.rollup.kpis.coverage, delegates: r.rollup.kpis.delegates })),
    classDistribution,
    priority,
    segments: await segments(activity),
    dailyReached: dailyReachedFrom(activity),
    supportRate: national.kpis.reached ? national.spine.supportive / national.kpis.reached : 0,
    reachRate: national.kpis.called ? national.kpis.reached / national.kpis.called : 0,
  };
}

export async function callers(): Promise<CallerPerf[]> {
  const [allStats, scope] = await Promise.all([getCallerStats(), getViewerScope()]);
  // Scope the performance board to the viewer's area (names, since stats carry names).
  const regionName =
    scope.role === "regional_coordinator" && scope.regionCode
      ? REAL_HIERARCHY.find((r) => r.code === scope.regionCode)?.name ?? null
      : null;
  const conName =
    scope.role === "constituency_coordinator" && scope.conCode
      ? REAL_HIERARCHY.flatMap((r) => r.constituencies).find((c) => c.code === scope.conCode)?.name ?? null
      : null;
  const stats = allStats.filter((s) => {
    if (conName) return s.constituency === conName;
    if (regionName) return s.region === regionName;
    return true; // super_admin / analyst — national
  });
  const reachedMax = Math.max(1, ...stats.map((s) => s.reached));
  return stats
    .map((s) => {
      const reachRate = s.attempts ? s.reached / s.attempts : 0;
      const conversion = s.reached ? s.supportive / s.reached : 0;
      // Simple coaching signal: strong reach + conversion = top; low reach with effort = coach.
      const flag: CallerPerf["flag"] =
        s.reached >= reachedMax * 0.75 && conversion >= 0.5 ? "top" : s.attempts >= 5 && reachRate < 0.3 ? "coach" : null;
      return { label: s.label, region: s.region, constituency: s.constituency, attempts: s.attempts, reached: s.reached, reachRate, conversion, flag };
    })
    .sort((a, b) => b.reached - a.reached);
}

// Review queue = potential duplicate delegates within a constituency (same phone
// number, or identical full name), surfaced from the roster for a human to fix.
// Scoped to the viewer's area.
export async function conflicts(): Promise<Conflict[]> {
  const [groups, scope] = await Promise.all([getRosterGroups(), getViewerScope()]);
  const allowed = new Set(
    scopeHierarchy(REAL_HIERARCHY, scope).flatMap((r) => r.constituencies.map((c) => rosterKey(r.name, c.name))),
  );
  const out: Conflict[] = [];
  for (const g of groups) {
    if (!allowed.has(rosterKey(g.region, g.constituency))) continue;
    const byPhone = new Map<string, typeof g.delegates>();
    const byName = new Map<string, typeof g.delegates>();
    for (const d of g.delegates) {
      const phone = (d.contact ?? "").replace(/\D/g, "");
      if (phone.length >= 9) (byPhone.get(phone) ?? byPhone.set(phone, []).get(phone)!).push(d);
      const name = d.name.trim().toLowerCase().replace(/\s+/g, " ");
      if (name.length >= 5) (byName.get(name) ?? byName.set(name, []).get(name)!).push(d);
    }
    const flagged = new Set<typeof g.delegates[number]>();
    const emit = (members: typeof g.delegates, reason: string) => {
      const fresh = members.filter((m) => !flagged.has(m));
      if (members.length < 2 || fresh.length === 0) return;
      members.forEach((m) => flagged.add(m));
      out.push({
        id: `${g.region}-${g.constituency}-${reason}-${members.map((m) => m.id ?? m.name).join("|")}`.slice(0, 140),
        delegateId: members[0].id ?? "",
        delegateName: members.map((m) => m.name).join(" / "),
        constituency: `${g.region} · ${g.constituency}`,
        branch: reason,
        rawFlags: members.map((m) => `${m.name} — ${m.position}${m.contact ? ` (${m.contact})` : ""}`),
        createdAt: "",
      });
    };
    for (const [phone, dels] of byPhone) if (dels.length > 1) emit(dels, `Same phone ${phone}`);
    for (const dels of byName.values()) if (dels.length > 1) emit(dels, "Same name");
  }
  return out;
}

export async function syncOverview(): Promise<SyncOverview> {
  const total = REAL_HIERARCHY.reduce((s, r) => s + r.constituencies.length, 0);
  return {
    lastSyncMins: -1,
    sheetsTotal: total,
    sheetsSynced: 0,
    staleSheets: 0,
    conflictsOpen: 0,
    nextSyncMins: 15,
    runs: [],
  };
}

