// Server-side session verification. The browser stores the Supabase access token
// in the `gg_token` cookie; here we verify it with Supabase and resolve the
// user's role + scope from their profile (service role). This is the real
// server-side gate for the dashboard — RLS protects PII at the DB, but the
// dashboard reads via the service role, so pages must be gated here too.
//
// cache() dedupes the work across a single request (layout + scope + pages).
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "./types";
import { adminConfigured, adminRest } from "./admin.server";

const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface ServerSession {
  userId: string;
  role: Role;
  isActive: boolean;
  regionCode: string | null;
  conCode: string | null;
  name: string;
}

export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  if (!adminConfigured || !SB_URL || !ANON) return null;
  try {
    const token = (await cookies()).get("gg_token")?.value;
    if (!token) return null;
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    if (!user?.id) return null;
    const rows = await adminRest<any[]>(
      `/rest/v1/profiles?user_id=eq.${user.id}&select=role,full_name,is_active,regions(code),constituencies(code)`,
    );
    const p = rows?.[0];
    if (!p?.role) return null;
    return {
      userId: user.id,
      role: p.role as Role,
      isActive: p.is_active !== false,
      regionCode: p.regions?.code ?? null,
      conCode: p.constituencies?.code ?? null,
      name: p.full_name ?? "",
    };
  } catch {
    return null;
  }
});
