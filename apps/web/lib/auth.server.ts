// Server-side session verification (cookie-based via @supabase/ssr). Reads the
// session from cookies, then resolves the user's role + scope from their profile
// (service role). This is the real server-side gate for the dashboard — RLS
// protects PII at the DB, but the dashboard reads via the service role, so pages
// must be gated here too. cache() dedupes the work across a single request.
import { cache } from "react";
import type { Role } from "./types";
import { adminConfigured, adminRest } from "./admin.server";
import { getServerSupabase } from "./supabase-server";

export interface ServerSession {
  userId: string;
  role: Role;
  isActive: boolean;
  regionCode: string | null;
  conCode: string | null;
  name: string;
}

export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  if (!adminConfigured) return null;
  try {
    const supabase = await getServerSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
