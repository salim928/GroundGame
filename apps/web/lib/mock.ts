// Typed mock data layer — shaped to the API contract so every screen is viewable
// before the NestJS backend is wired (Build Spec: "wire the prototype to real data").
import { addSpines, classify, projectShare, spineTotal } from "./analytics";
import type {
  Alert,
  AnalyticsPayload,
  CallerPerf,
  Classification,
  Conflict,
  ConstituencyPayload,
  ConstituencyRollup,
  DelegateRow,
  Kpis,
  Member,
  OverviewPayload,
  ProjectionPayload,
  RegionPayload,
  RegionRollup,
  SegmentEngagement,
  Spine,
} from "./types";

// Deterministic PRNG so the dashboard renders identically each load.
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const REGIONS = [
  { name: "Greater Accra", code: "GAR", constituencies: 8 },
  { name: "Ashanti", code: "ASH", constituencies: 10 },
  { name: "Northern", code: "NOR", constituencies: 6 },
  { name: "Western", code: "WES", constituencies: 5 },
  { name: "Volta", code: "VOL", constituencies: 5 },
];

const BRANCH_NAMES = ["Central", "North", "South", "East", "West", "New Town", "Market", "Zongo"];

function makeSpine(total: number, rand: () => number): Spine {
  const reached = Math.round(total * (0.45 + rand() * 0.4));
  const notReached = total - reached;
  const supportive = Math.round(reached * (0.4 + rand() * 0.35));
  const opposed = Math.round((reached - supportive) * (0.15 + rand() * 0.4));
  const undecided = reached - supportive - opposed;
  return { supportive, undecided, opposed, notReached };
}

function kpisFromSpine(s: Spine): Kpis {
  const delegates = spineTotal(s);
  const called = delegates - s.notReached + Math.round(s.notReached * 0.3);
  const reached = s.supportive + s.undecided + s.opposed;
  return {
    delegates,
    called: Math.min(called, delegates),
    reached,
    projectedSupport: projectShare(s),
    coverage: delegates ? Math.min(called, delegates) / delegates : 0,
  };
}

interface MockConstituency extends ConstituencyRollup {}

function buildConstituencies(): { byRegion: Record<string, MockConstituency[]>; all: MockConstituency[] } {
  const byRegion: Record<string, MockConstituency[]> = {};
  const all: MockConstituency[] = [];
  let n = 0;
  for (const region of REGIONS) {
    const rid = `r-${region.code}`;
    byRegion[rid] = [];
    for (let i = 0; i < region.constituencies; i++) {
      n++;
      const rand = rng(n * 97 + 13);
      const total = 8 + Math.floor(rand() * 6); // ~10 contacts/constituency target
      const spine = makeSpine(total, rand);
      const kpis = kpisFromSpine(spine);
      const callers = Math.floor(rand() * 5);
      const c: MockConstituency = {
        id: `c-${region.code}-${i + 1}`,
        regionId: rid,
        name: `${region.name} ${i + 1}`,
        code: `${region.code}${String(i + 1).padStart(2, "0")}`,
        kpis,
        spine,
        callersAssigned: callers,
        targetContacts: 10,
        classification: classify(kpis.projectedSupport),
        status: callers === 0 ? "no_callers" : kpis.coverage < 0.5 ? "behind" : "ok",
      };
      byRegion[rid].push(c);
      all.push(c);
    }
  }
  return { byRegion, all };
}

const { byRegion, all: allConstituencies } = buildConstituencies();

function regionRollup(code: string, name: string): RegionRollup {
  const rid = `r-${code}`;
  const cons = byRegion[rid];
  const spine = cons.reduce<Spine>((acc, c) => addSpines(acc, c.spine), {
    supportive: 0,
    undecided: 0,
    opposed: 0,
    notReached: 0,
  });
  const kpis = kpisFromSpine(spine);
  return {
    id: rid,
    name,
    code,
    kpis,
    spine,
    constituencies: cons.length,
    classification: classify(kpis.projectedSupport),
  };
}

const regionRollups = REGIONS.map((r) => regionRollup(r.code, r.name));

function nationalSpine(): Spine {
  return regionRollups.reduce<Spine>((acc, r) => addSpines(acc, r.spine), {
    supportive: 0,
    undecided: 0,
    opposed: 0,
    notReached: 0,
  });
}

const segments: SegmentEngagement[] = [
  { segment: "former_exec", label: "Former Executives", total: 180, reached: 121 },
  { segment: "current_exec", label: "Current Executives", total: 142, reached: 119 },
  { segment: "aspiring_exec", label: "Aspiring Executives", total: 96, reached: 54 },
  { segment: "influencer", label: "Influencers", total: 64, reached: 41 },
];

const alerts: Alert[] = [
  { id: "a1", kind: "behind_target", severity: "warn", message: "12 constituencies below 50% coverage", scope: "National" },
  { id: "a2", kind: "pending_conflicts", severity: "critical", message: "5 outcome conflicts awaiting review", scope: "Ashanti" },
  { id: "a3", kind: "no_callers", severity: "warn", message: "7 constituencies have no callers assigned", scope: "National" },
  { id: "a4", kind: "callbacks_due", severity: "info", message: "23 callbacks due today", scope: "Greater Accra" },
  { id: "a5", kind: "stale_data", severity: "info", message: "Volta 3 not synced in 2 hours", scope: "Volta" },
];

function dailyReached() {
  const out = [];
  const rand = rng(42);
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), reached: 20 + Math.floor(rand() * 60) });
  }
  return out;
}

export function getOverview(): OverviewPayload {
  const spine = nationalSpine();
  const kpis = kpisFromSpine(spine);
  const reached = spine.supportive + spine.undecided + spine.opposed;
  const target = allConstituencies.reduce((s, c) => s + c.targetContacts, 0);
  const series = dailyReached();
  const reachedPerDay = Math.round(series.reduce((s, d) => s + d.reached, 0) / series.length);
  const daysLeft = 21;
  const remaining = Math.max(0, target - reached);

  const noCallers = allConstituencies.filter((c) => c.status === "no_callers").length;

  return {
    kpis,
    spine,
    dailyReached: series,
    alerts,
    regions: regionRollups,
    segments,
    syncHealth: {
      lastSyncMins: 4,
      sheetsSynced: allConstituencies.length - 1,
      sheetsTotal: allConstituencies.length,
      conflictsOpen: 5,
      staleSheets: 1,
    },
    paceToTarget: {
      reachedToTarget: target ? Math.min(1, reached / target) : 0,
      target,
      daysLeft,
      reachedPerDay,
      requiredPerDay: Math.ceil(remaining / daysLeft),
      onPace: reachedPerDay >= Math.ceil(remaining / daysLeft),
    },
    trends: { coverage: 3, reached: 6, support: 2, delegates: 0 },
  };
}

export function getRegions(): RegionRollup[] {
  return regionRollups;
}

export function getRegion(id: string): RegionPayload | null {
  const region = regionRollups.find((r) => r.id === id);
  if (!region) return null;
  return {
    region,
    spine: region.spine,
    segments,
    constituencies: byRegion[id] ?? [],
  };
}

const FIRST = ["Ama", "Kofi", "Yaa", "Kwame", "Akua", "Kojo", "Abena", "Yaw", "Adwoa", "Kwesi"];
const LAST = ["Mensah", "Owusu", "Asante", "Boateng", "Addo", "Darko", "Appiah", "Annan", "Tetteh", "Agyei"];

export function getConstituency(id: string): ConstituencyPayload | null {
  const constituency = allConstituencies.find((c) => c.id === id);
  if (!constituency) return null;
  const rand = rng(id.length * 31 + (id.charCodeAt(id.length - 1) || 1));
  const total = constituency.kpis.delegates;

  const delegates: DelegateRow[] = [];
  const outcomes: (DelegateRow["outcome"])[] = ["supportive", "undecided", "hostile", "wrong_number", null];
  for (let i = 0; i < total; i++) {
    const called = rand() > 0.25;
    const reached = called && rand() > 0.35;
    const outcome = reached ? outcomes[Math.floor(rand() * 4)] : null;
    delegates.push({
      id: `${id}-d${i + 1}`,
      externalRef: `${constituency.code}-${String(i + 1).padStart(4, "0")}`,
      name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`,
      branch: BRANCH_NAMES[i % BRANCH_NAMES.length],
      phone: `+233 ${20 + Math.floor(rand() * 9)} ${100 + Math.floor(rand() * 900)} ${1000 + Math.floor(rand() * 9000)}`,
      type: ["Former Exec", "Current Exec", "Aspiring Exec", "Member"][Math.floor(rand() * 4)],
      caller: constituency.callersAssigned > 0 ? `Caller ${1 + Math.floor(rand() * constituency.callersAssigned)}` : null,
      called,
      reached,
      outcome,
      isInfluencer: rand() > 0.85,
      hasConflict: rand() > 0.92,
    });
  }

  const branchMap = new Map<string, Branch>();
  for (const d of delegates) {
    const b = branchMap.get(d.branch) ?? {
      id: `${id}-b-${d.branch}`,
      name: d.branch,
      code: d.branch.slice(0, 3).toUpperCase(),
      spine: { supportive: 0, undecided: 0, opposed: 0, notReached: 0 },
      delegates: 0,
      called: 0,
    };
    b.delegates++;
    if (d.called) b.called++;
    if (!d.reached) b.spine.notReached++;
    else if (d.outcome === "supportive") b.spine.supportive++;
    else if (d.outcome === "hostile") b.spine.opposed++;
    else b.spine.undecided++;
    branchMap.set(d.branch, b);
  }

  const callers = Array.from({ length: constituency.callersAssigned }, (_, i) => {
    const assigned = delegates.filter((d) => d.caller === `Caller ${i + 1}`);
    return {
      label: `Caller ${i + 1}`,
      attempts: assigned.filter((d) => d.called).length,
      reached: assigned.filter((d) => d.reached).length,
      assigned: assigned.length,
      lastActive: `${1 + Math.floor(rand() * 5)}h ago`,
    };
  });

  const callbacks = delegates
    .filter((d) => d.called && !d.reached && rand() > 0.6)
    .slice(0, 6)
    .map((d) => ({
      delegateId: d.id,
      name: d.name,
      branch: d.branch,
      callbackAt: "Today 16:00",
      caller: d.caller ?? "—",
    }));

  return {
    constituency,
    spine: constituency.spine,
    branches: Array.from(branchMap.values()),
    callbacks,
    callers,
    delegates,
  };
}

interface Branch {
  id: string;
  name: string;
  code: string;
  spine: Spine;
  delegates: number;
  called: number;
}

export function getProjection(): ProjectionPayload {
  const spine = nationalSpine();
  const share = projectShare(spine);
  return {
    spine,
    weights: { supportive: 1.0, undecided: 0.35, not_reached: 0.15, opposed: 0.0 },
    headline: share,
    confidenceBand: [Math.max(0, share - 0.06), Math.min(1, share + 0.06)],
  };
}

export function getCallers(): CallerPerf[] {
  const out: CallerPerf[] = [];
  let n = 0;
  for (const region of REGIONS) {
    for (const c of byRegion[`r-${region.code}`].slice(0, 2)) {
      for (let i = 0; i < (c.callersAssigned || 1); i++) {
        n++;
        const rand = rng(n * 53);
        const attempts = 20 + Math.floor(rand() * 80);
        const reached = Math.floor(attempts * (0.4 + rand() * 0.4));
        const supportive = Math.floor(reached * (0.3 + rand() * 0.4));
        const reachRate = attempts ? reached / attempts : 0;
        const conversion = reached ? supportive / reached : 0;
        out.push({
          label: `Caller ${n}`,
          region: region.name,
          constituency: c.name,
          attempts,
          reached,
          reachRate,
          conversion,
          flag: reachRate > 0.7 && conversion > 0.5 ? "top" : reachRate < 0.45 ? "coach" : null,
        });
      }
    }
  }
  return out.sort((a, b) => b.conversion - a.conversion);
}

export function getConflicts(): Conflict[] {
  const flagSets = [
    ["Supportive", "Opposed"],
    ["Supportive", "Undecided"],
    ["Undecided", "Opposed"],
  ];
  return Array.from({ length: 5 }, (_, i) => {
    const c = allConstituencies[i * 3 + 1];
    const rand = rng(i * 17 + 5);
    return {
      id: `conf-${i + 1}`,
      delegateId: `${c.id}-d${i + 2}`,
      delegateName: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`,
      constituency: c.name,
      branch: BRANCH_NAMES[i % BRANCH_NAMES.length],
      rawFlags: flagSets[i % flagSets.length],
      createdAt: `${1 + i}h ago`,
    };
  });
}

export function getAnalytics(): AnalyticsPayload {
  const spine = nationalSpine();
  const national = kpisFromSpine(spine);
  const reached = spine.supportive + spine.undecided + spine.opposed;

  const funnel = [
    { stage: "Delegates", value: national.delegates },
    { stage: "Called", value: national.called },
    { stage: "Reached", value: reached },
    { stage: "Supportive", value: spine.supportive },
  ];

  const regions = regionRollups.map((r) => ({
    name: r.name,
    code: r.code,
    coverage: r.kpis.coverage,
    projected: r.kpis.projectedSupport,
    delegates: r.kpis.delegates,
  }));

  const classCounts: Record<Classification, number> = { stronghold: 0, lean: 0, tossup: 0, weak: 0 };
  for (const c of allConstituencies) classCounts[c.classification]++;
  const classDistribution = (Object.keys(classCounts) as Classification[]).map((k) => ({
    classification: k,
    count: classCounts[k],
  }));

  // Priority ranking: high-delegate, low-coverage first (Section 11 Geographic).
  const priority = allConstituencies
    .map((c) => ({
      id: c.id,
      name: c.name,
      region: REGIONS.find((r) => `r-${r.code}` === c.regionId)?.name ?? "",
      delegates: c.kpis.delegates,
      coverage: c.kpis.coverage,
      projected: c.kpis.projectedSupport,
      gap: c.kpis.delegates * (1 - c.kpis.coverage),
      classification: c.classification,
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8);

  return {
    kpis: national,
    spine,
    funnel,
    regions,
    classDistribution,
    priority,
    segments,
    dailyReached: dailyReached(),
    supportRate: reached ? spine.supportive / reached : 0,
    reachRate: national.called ? reached / national.called : 0,
  };
}

export function getSyncOverview(): import("./types").SyncOverview {
  const statuses: ("success" | "partial" | "failed")[] = ["success", "success", "success", "partial", "success", "failed"];
  const runs = allConstituencies.slice(0, 14).map((c, i) => {
    const rand = rng(i * 41 + 7);
    const status = statuses[i % statuses.length];
    const pulled = c.kpis.delegates;
    return {
      id: `run-${c.id}`,
      constituency: c.name,
      region: REGIONS.find((r) => `r-${r.code}` === c.regionId)?.name ?? "",
      status,
      rowsPulled: pulled,
      rowsWritten: status === "failed" ? 0 : Math.round(pulled * (0.7 + rand() * 0.3)),
      conflicts: status === "partial" ? 1 + Math.floor(rand() * 2) : 0,
      finishedAt: `${1 + Math.floor(rand() * 14)}m ago`,
      durationSec: 2 + Math.floor(rand() * 9),
    };
  });
  return {
    lastSyncMins: 4,
    sheetsTotal: allConstituencies.length,
    sheetsSynced: allConstituencies.length - 1,
    staleSheets: 1,
    conflictsOpen: 5,
    nextSyncMins: 11,
    runs,
  };
}

export function getMembers(): Member[] {
  return [
    { userId: "u1", fullName: "Salim Adams", role: "super_admin", scope: "National", email: "salim@groundgame.app", isActive: true },
    { userId: "u2", fullName: "Efua Sarpong", role: "regional_coordinator", scope: "Greater Accra", email: "efua@groundgame.app", isActive: true },
    { userId: "u3", fullName: "Kwabena Osei", role: "regional_coordinator", scope: "Ashanti", email: "kwabena@groundgame.app", isActive: true },
    { userId: "u4", fullName: "Naa Adjeley", role: "constituency_coordinator", scope: "Greater Accra 1", email: "naa@groundgame.app", isActive: true },
    { userId: "u5", fullName: "Yaw Donkor", role: "analyst", scope: "National (read)", email: "yaw@groundgame.app", isActive: true },
    { userId: "u6", fullName: "Mariama Issah", role: "constituency_coordinator", scope: "Northern 2", email: "mariama@groundgame.app", isActive: false },
  ];
}
