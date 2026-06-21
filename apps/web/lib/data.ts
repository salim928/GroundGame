// Data-access seam for the dashboard. Serves real data computed from the delegate
// roster (Supabase/file) and hierarchy — no mock/synthesized numbers. Server-only.
import * as real from "./real.server";

export const data = {
  overview: () => real.overview(),
  regions: () => real.regions(),
  region: (id: string) => real.region(id),
  constituency: (id: string) => real.constituency(id),
  analytics: () => real.analytics(),
  callers: () => real.callers(),
  conflicts: () => real.conflicts(),
  members: () => real.members(),
  syncOverview: () => real.syncOverview(),
};
