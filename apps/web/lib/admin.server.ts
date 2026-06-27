// Server-only privileged helpers (service-role). NEVER import from a client
// component. Used by route handlers to verify the requester's identity/scope and
// to perform admin writes (create caller logins) that bypass RLS by design.
import { NextResponse } from "next/server";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const adminConfigured = Boolean(URL && SERVICE);

const svcHeaders = {
  apikey: SERVICE ?? "",
  Authorization: `Bearer ${SERVICE ?? ""}`,
  "Content-Type": "application/json",
};

/** Service-role REST/Auth call (bypasses RLS). Throws on non-2xx. */
export async function adminRest<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: { ...svcHeaders, ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Paginated GET that pages past PostgREST's 1000-row cap. The path must already
 *  include an `order=` for stable paging. */
export async function adminRestAll<T = any>(path: string): Promise<T[]> {
  const rows: T[] = [];
  const PAGE = 1000;
  const sep = path.includes("?") ? "&" : "?";
  for (let offset = 0; ; offset += PAGE) {
    const page = await adminRest<T[]>(`${path}${sep}limit=${PAGE}&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export interface Requester {
  userId: string;
  role: string;
  regionId: string | null;
  constituencyId: string | null;
}

/** Verify the caller's JWT (from the Authorization header) and load their scope. */
export async function getRequester(req: Request): Promise<Requester | null> {
  const auth = req.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token || !URL || !ANON) return null;
  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id?: string };
  if (!user?.id) return null;
  const rows = await adminRest<Array<{ role: string; region_id: string | null; constituency_id: string | null }>>(
    `/rest/v1/profiles?user_id=eq.${user.id}&select=role,region_id,constituency_id`,
  );
  const p = rows?.[0];
  if (!p) return null;
  return { userId: user.id, role: p.role, regionId: p.region_id, constituencyId: p.constituency_id };
}

/** Surface the underlying Supabase/GoTrue error (this is an internal admin tool). */
export function serverError(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

/** Can this requester manage callers for the given constituency (by region/constituency id)? */
export function canManageConstituency(r: Requester, regionId: string | null, constituencyId: string | null): boolean {
  switch (r.role) {
    case "super_admin":
      return true;
    case "regional_coordinator":
      return Boolean(regionId) && regionId === r.regionId;
    case "constituency_coordinator":
      return Boolean(constituencyId) && constituencyId === r.constituencyId;
    default:
      return false;
  }
}
