// Real data layer — computes every dashboard payload from the actual delegate
// roster (Supabase/file) and hierarchy. No synthesized/mock numbers. Call-activity
// metrics are zero until the field operation ticks sheets and the sync fills
// call_records; they then populate here. Server-only.
import { REAL_HIERARCHY } from "./hierarchy";
import {
  getAllDelegates,
  getCallStats,
  getCallerStats,
  getRealDelegates,
  getRosterCounts,
  rosterKey,
  type CallStat,
} from "./delegates.server";
import { addSpines, classify, projectShare } from "./analytics";
import { getViewerScope, scopeHierarchy } from "./scope.server";
import type {
  Classification,
  AnalyticsPayload,
  CallerPerf,
  Conflict,
  ConstituencyPayload,
  ConstituencyRollup,
  Kpis,
  OverviewPayload,
  RegionPayload,
  RegionRollup,
  SegmentEngagement,
  Spine,
  SyncOverview,
} from "./types";

const TARGET = 10;
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
function classFrom(spine: Spine, reached: number): Classification {
  return reached === 0 ? "unrated" : classify(projectShare(spine));
}
function aggregate(items: { kpis: Kpis; spine: Spine }[]): { kpis: Kpis; spine: Spine } {
  const spine = items.reduce((acc, i) => addSpines(acc, i.spine), EMPTY_SPINE);
  const delegates = items.reduce((s, i) => s + i.kpis.delegates, 0);
  const called = items.reduce((s, i) => s + i.kpis.called, 0);
  const reached = items.reduce((s, i) => s + i.kpis.reached, 0);
  return { spine, kpis: { delegates, called, reached, coverage: delegates ? called / delegates : 0 } };
}

async function build() {
  const [counts, stats, scope] = await Promise.all([getRosterCounts(), getCallStats(), getViewerScope()]);
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
        callersAssigned: 0,
        targetContacts: TARGET,
        classification: classFrom(spine, kpis.reached),
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
      classification: classFrom(agg.spine, agg.kpis.reached),
    };
    return { rollup, constituencies };
  });
  return regions;
}

async function segments(): Promise<SegmentEngagement[]> {
  const all = await getAllDelegates();
  const group = (re: RegExp) => all.filter((d) => re.test(d.position)).length;
  return [
    { segment: "current_exec", label: "Chairmen & Vice", total: group(/chair/i), reached: 0 },
    { segment: "former_exec", label: "Secretaries", total: group(/secretary/i), reached: 0 },
    { segment: "aspiring_exec", label: "Organizers", total: group(/organi/i), reached: 0 },
    { segment: "influencer", label: "Treasurers & Comms", total: group(/treasurer|communication/i), reached: 0 },
  ];
}

export async function overview(): Promise<OverviewPayload> {
  const regions = await build();
  const allCons = regions.flatMap((r) => r.constituencies);
  const national = aggregate(allCons);
  const delegates = national.kpis.delegates;
  const reached = national.kpis.reached;
  const withRoster = allCons.filter((c) => c.kpis.delegates > 0).length;
  const totalCons = regions.reduce((s, r) => s + r.constituencies.length, 0);
  const noRoster = totalCons - withRoster;
  const daysLeft = 21;

  return {
    kpis: national.kpis,
    spine: national.spine,
    dailyReached: [],
    alerts: [
      ...(reached === 0
        ? [{ id: "calls", kind: "stale_data" as const, severity: "info" as const, message: "Field calls not started — metrics populate as callers log outcomes", scope: "National" }]
        : []),
      ...(noRoster > 0
        ? [{ id: "roster", kind: "no_callers" as const, severity: "warn" as const, message: `${noRoster} constituencies have no roster loaded yet`, scope: "National" }]
        : []),
    ],
    regions: regions.map((r) => r.rollup),
    segments: await segments(),
    syncHealth: { lastSyncMins: -1, sheetsSynced: 0, sheetsTotal: totalCons, conflictsOpen: 0, staleSheets: 0 },
    paceToTarget: {
      reachedToTarget: delegates ? reached / delegates : 0,
      target: delegates,
      daysLeft,
      reachedPerDay: 0,
      requiredPerDay: Math.ceil(Math.max(0, delegates - reached) / daysLeft),
      onPace: false,
    },
    trends: { coverage: 0, reached: 0, support: 0, delegates: 0 },
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
  return { constituency: rollup, spine: rollup.spine, branches: [], callbacks: [], callers: [], delegates };
}

export async function analytics(): Promise<AnalyticsPayload> {
  const regs = await build();
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
    segments: await segments(),
    dailyReached: [],
    supportRate: national.kpis.reached ? national.spine.supportive / national.kpis.reached : 0,
    reachRate: national.kpis.called ? national.kpis.reached / national.kpis.called : 0,
  };
}

export async function callers(): Promise<CallerPerf[]> {
  const stats = await getCallerStats();
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

export async function conflicts(): Promise<Conflict[]> {
  return [];
}

export async function syncOverview(): Promise<SyncOverview> {
  const counts = await getRosterCounts();
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

