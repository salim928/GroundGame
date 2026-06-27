// Client-side session snapshot. Authentication is real (Supabase Auth + JWT);
// after sign-in we cache the resolved role/scope here for the UI, and mirror the
// scope into a cookie so server components can scope data per request.
import type { Role } from "./types";

export interface DemoPersona {
  key: string;
  name: string;
  role: Role;
  roleLabel: string;
  scope: string;
  email: string;
  /** Region/constituency codes that scope what this user sees (server reads via cookie). */
  regionCode?: string | null;
  conCode?: string | null;
}

const KEY = "gg.session";

export function getSession(): DemoPersona | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoPersona) : null;
  } catch {
    return null;
  }
}

export function setSession(p: DemoPersona): void {
  window.localStorage.setItem(KEY, JSON.stringify(p));
  // Mirror the viewer scope into a cookie so server components can scope data.
  const scope = { role: p.role, regionCode: p.regionCode ?? null, conCode: p.conCode ?? null };
  document.cookie = `gg_scope=${encodeURIComponent(JSON.stringify(scope))}; path=/; max-age=86400; samesite=lax`;
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
  document.cookie = "gg_scope=; path=/; max-age=0; samesite=lax";
}
