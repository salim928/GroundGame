// Server-side viewer scope. The browser stores the signed-in role + region/
// constituency code in the `gg_scope` cookie at login; force-dynamic dashboard
// pages read it here to limit what coordinators see to their own area.
//
// NOTE: this is a UI-level scope (the hard PII boundary is Supabase RLS via the
// caller's own JWT). Super admins and analysts see everything.
import { cookies } from "next/headers";
import type { Role } from "./types";
import { REAL_HIERARCHY } from "./hierarchy";

export interface ViewerScope {
  role: Role;
  regionCode: string | null;
  conCode: string | null;
}

const FULL: ViewerScope = { role: "super_admin", regionCode: null, conCode: null };

export async function getViewerScope(): Promise<ViewerScope> {
  try {
    const raw = (await cookies()).get("gg_scope")?.value;
    if (!raw) return FULL;
    const p = JSON.parse(decodeURIComponent(raw));
    return { role: (p.role as Role) ?? "super_admin", regionCode: p.regionCode ?? null, conCode: p.conCode ?? null };
  } catch {
    return FULL;
  }
}

type Hierarchy = typeof REAL_HIERARCHY;

/** Narrow the hierarchy to the viewer's assigned area. Driven by the assigned
 *  codes, not the role name, so every non-super role respects its scope: a
 *  constituency assignment shows just that constituency, a region assignment
 *  shows that region (covers regional coordinators AND a region-scoped analyst),
 *  and an unassigned/national user (super admin, national analyst) sees all. */
export function scopeHierarchy(hierarchy: Hierarchy, scope: ViewerScope): Hierarchy {
  if (scope.role === "super_admin") return hierarchy;
  if (scope.conCode) {
    return hierarchy
      .filter((r) => r.constituencies.some((c) => c.code === scope.conCode))
      .map((r) => ({ ...r, constituencies: r.constituencies.filter((c) => c.code === scope.conCode) }));
  }
  if (scope.regionCode) {
    return hierarchy.filter((r) => r.code === scope.regionCode);
  }
  return hierarchy;
}
