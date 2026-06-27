// Data contract for the dashboard — mirrors the NestJS API (Build Spec Sections 10–12).
// The support spine breakdown recurs at every level of geography (Section 10).

export type Role =
  | "super_admin"
  | "regional_coordinator"
  | "constituency_coordinator"
  | "analyst"
  | "caller";

export type Outcome = "supportive" | "undecided" | "hostile" | "wrong_number";
export type Classification = "stronghold" | "lean" | "tossup" | "weak" | "unrated";

/** Stacked Supportive / Undecided / Opposed / Not-reached counts — the "support spine". */
export interface Spine {
  supportive: number;
  undecided: number;
  opposed: number;
  notReached: number;
}

export interface Kpis {
  delegates: number;
  called: number;
  reached: number;
  /** called / delegates (0–1). */
  coverage: number;
}

export interface DailyReached {
  date: string; // ISO date
  reached: number;
}

export interface Alert {
  id: string;
  kind: "behind_target" | "pending_conflicts" | "stale_data" | "callbacks_due" | "no_callers";
  severity: "info" | "warn" | "critical";
  message: string;
  scope?: string;
}

export interface SegmentEngagement {
  segment: "former_exec" | "current_exec" | "aspiring_exec" | "influencer";
  label: string;
  total: number;
  reached: number;
}

export interface RegionRollup {
  id: string;
  name: string;
  code: string;
  kpis: Kpis;
  spine: Spine;
  constituencies: number;
  classification: Classification;
}

export interface ConstituencyRollup {
  id: string;
  regionId: string;
  name: string;
  code: string;
  kpis: Kpis;
  spine: Spine;
  callersAssigned: number;
  targetContacts: number;
  classification: Classification;
  status: "ok" | "behind" | "no_callers";
}

export interface SyncHealth {
  lastSyncMins: number;
  sheetsSynced: number;
  sheetsTotal: number;
  conflictsOpen: number;
  staleSheets: number;
}

export interface PaceToTarget {
  reachedToTarget: number; // 0–1 of target reached
  target: number;
  daysLeft: number;
  reachedPerDay: number;
  requiredPerDay: number;
  onPace: boolean;
}

export interface Trends {
  coverage: number; // percentage-point change vs prior period
  reached: number;
  support: number;
  delegates: number;
}

export interface OverviewPayload {
  kpis: Kpis;
  spine: Spine;
  dailyReached: DailyReached[];
  alerts: Alert[];
  regions: RegionRollup[];
  segments: SegmentEngagement[];
  syncHealth: SyncHealth;
  paceToTarget: PaceToTarget;
  trends: Trends;
}

export interface RegionPayload {
  region: RegionRollup;
  spine: Spine;
  segments: SegmentEngagement[];
  constituencies: ConstituencyRollup[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  spine: Spine;
  delegates: number;
  called: number;
}

export interface CallbackDue {
  delegateId: string;
  name: string;
  branch: string;
  callbackAt: string;
  caller: string;
}

export interface CallerBoardItem {
  label: string;
  attempts: number;
  reached: number;
  assigned: number;
  lastActive: string;
}

export interface DelegateRow {
  id: string;
  externalRef: string;
  name: string;
  branch: string;
  phone: string;
  type: string;
  caller: string | null;
  called: boolean;
  reached: boolean;
  outcome: Outcome | null;
  isInfluencer: boolean;
  hasConflict: boolean;
}

export interface ConstituencyPayload {
  constituency: ConstituencyRollup;
  spine: Spine;
  branches: Branch[];
  callbacks: CallbackDue[];
  callers: CallerBoardItem[];
  delegates: DelegateRow[];
}

// Weights used internally to classify constituencies once calls exist (not surfaced as a metric).
export interface ProjectionWeights {
  supportive: number;
  undecided: number;
  not_reached: number;
  opposed: number;
}

export interface CallerPerf {
  label: string;
  region: string;
  constituency: string;
  attempts: number;
  reached: number;
  reachRate: number; // 0–1
  conversion: number; // supportive / reached, 0–1
  flag: "top" | "coach" | null;
}

export interface Conflict {
  id: string;
  delegateId: string;
  delegateName: string;
  constituency: string;
  branch: string;
  rawFlags: string[]; // clashing ticks, e.g. ["Supportive","Opposed"]
  createdAt: string;
}

export interface Member {
  userId: string;
  fullName: string;
  role: Role;
  scope: string;
  email: string;
  isActive: boolean;
  regionCode?: string | null;
  conCode?: string | null;
}

export interface FunnelStage {
  stage: string;
  value: number;
}

export interface RegionComparison {
  name: string;
  code: string;
  coverage: number; // 0–1
  delegates: number;
}

export interface ClassDistribution {
  classification: Classification;
  count: number;
}

export interface PriorityConstituency {
  id: string;
  name: string;
  region: string;
  delegates: number;
  coverage: number;
  gap: number; // priority score: high delegates + low coverage
  classification: Classification;
}

export interface AnalyticsPayload {
  kpis: Kpis;
  spine: Spine;
  funnel: FunnelStage[];
  regions: RegionComparison[];
  classDistribution: ClassDistribution[];
  priority: PriorityConstituency[];
  segments: SegmentEngagement[];
  dailyReached: DailyReached[];
  supportRate: number; // supportive / reached
  reachRate: number; // reached / called
}

export interface SyncRun {
  id: string;
  constituency: string;
  region: string;
  status: "success" | "partial" | "failed" | "running";
  rowsPulled: number;
  rowsWritten: number;
  conflicts: number;
  finishedAt: string; // relative label
  durationSec: number;
}

export interface SyncOverview {
  lastSyncMins: number;
  sheetsTotal: number;
  sheetsSynced: number;
  staleSheets: number;
  conflictsOpen: number;
  nextSyncMins: number;
  runs: SyncRun[];
}

export interface UploadPreview {
  regions: number;
  constituencies: number;
  branches: number;
  delegates: number;
  duplicates: number;
  newDelegates: number;
  updatedDelegates: number;
}
