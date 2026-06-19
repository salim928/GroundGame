// Single data-access seam. Today it serves the typed mock layer; flipping
// NEXT_PUBLIC_USE_MOCK=false routes the same shapes through the NestJS API (Section 12).
import * as mock from "./mock";
import type {
  AnalyticsPayload,
  CallerPerf,
  Conflict,
  ConstituencyPayload,
  Member,
  OverviewPayload,
  ProjectionPayload,
  RegionPayload,
  RegionRollup,
  SyncOverview,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false" || !API_BASE;

async function apiGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  // Attach the Supabase JWT for the NestJS guards when running in the browser.
  if (typeof window !== "undefined") {
    const { getAccessToken } = await import("./supabase");
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", headers });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const data = {
  overview: (): Promise<OverviewPayload> =>
    USE_MOCK ? Promise.resolve(mock.getOverview()) : apiGet<OverviewPayload>("/analytics/overview"),
  regions: (): Promise<RegionRollup[]> =>
    USE_MOCK ? Promise.resolve(mock.getRegions()) : apiGet<RegionRollup[]>("/regions"),
  region: (id: string): Promise<RegionPayload | null> =>
    USE_MOCK ? Promise.resolve(mock.getRegion(id)) : apiGet<RegionPayload | null>(`/analytics/region/${id}`),
  constituency: (id: string): Promise<ConstituencyPayload | null> =>
    USE_MOCK
      ? Promise.resolve(mock.getConstituency(id))
      : apiGet<ConstituencyPayload | null>(`/analytics/constituency/${id}`),
  projection: (): Promise<ProjectionPayload> =>
    USE_MOCK ? Promise.resolve(mock.getProjection()) : apiGet<ProjectionPayload>("/analytics/projection"),
  analytics: (): Promise<AnalyticsPayload> =>
    USE_MOCK ? Promise.resolve(mock.getAnalytics()) : apiGet<AnalyticsPayload>("/analytics/report"),
  callers: (): Promise<CallerPerf[]> =>
    USE_MOCK ? Promise.resolve(mock.getCallers()) : apiGet<CallerPerf[]>("/analytics/callers"),
  conflicts: (): Promise<Conflict[]> =>
    USE_MOCK ? Promise.resolve(mock.getConflicts()) : apiGet<Conflict[]>("/conflicts"),
  members: (): Promise<Member[]> =>
    USE_MOCK ? Promise.resolve(mock.getMembers()) : apiGet<Member[]>("/users"),
  syncOverview: (): Promise<SyncOverview> =>
    USE_MOCK ? Promise.resolve(mock.getSyncOverview()) : apiGet<SyncOverview>("/sync/status"),
};

export const usingMock = USE_MOCK;
