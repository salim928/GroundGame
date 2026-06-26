// Central role + access policy. Imported by the login portals, the route guard,
// and the sidebar so there's a single source of truth for "who can go where".
import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  regional_coordinator: "Regional Coordinator",
  constituency_coordinator: "Constituency Coordinator",
  analyst: "Analyst",
  caller: "Caller",
};

// URL slug used by the per-role login portals: /login/<slug>.
export const ROLE_SLUG: Record<Role, string> = {
  super_admin: "admin",
  regional_coordinator: "regional",
  constituency_coordinator: "constituency",
  analyst: "analyst",
  caller: "caller",
};

export const SLUG_ROLE: Record<string, Role> = Object.fromEntries(
  Object.entries(ROLE_SLUG).map(([role, slug]) => [slug, role as Role]),
) as Record<string, Role>;

// Where a role lands after sign-in / when redirected out of a forbidden page.
export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/dashboard",
  regional_coordinator: "/dashboard",
  constituency_coordinator: "/dashboard",
  analyst: "/dashboard",
  caller: "/caller",
};

// Allowed route prefixes per role ("*" = everything). Privileged sections
// (/upload, /settings/*) stay super-admin only; callers are locked to /caller.
const STAFF_VIEW = [
  "/dashboard",
  "/regions",
  "/analytics",
  "/directory",
  "/callers",
  "/constituencies",
];

const ALLOWED: Record<Role, string[]> = {
  super_admin: ["*"],
  regional_coordinator: STAFF_VIEW,
  constituency_coordinator: STAFF_VIEW,
  analyst: STAFF_VIEW,
  caller: ["/caller"],
};

/** Is `pathname` within `role`'s allowed area? Prefix match on route segments. */
export function canAccess(role: Role, pathname: string): boolean {
  const rules = ALLOWED[role] ?? [];
  if (rules.includes("*")) return true;
  return rules.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Roles allowed to create/deactivate field callers. */
export const CALLER_MANAGER_ROLES: Role[] = [
  "super_admin",
  "regional_coordinator",
  "constituency_coordinator",
];

/** Roles allowed to add/edit/delete delegates (analyst + caller are read-only). */
export const DELEGATE_EDITOR_ROLES: Role[] = [
  "super_admin",
  "regional_coordinator",
  "constituency_coordinator",
];

export function canEditDelegates(role: Role | null | undefined): boolean {
  return !!role && DELEGATE_EDITOR_ROLES.includes(role);
}
