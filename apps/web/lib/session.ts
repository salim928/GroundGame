// Lightweight demo session (client-side only). No real auth yet — this lets you
// explore the app as different personas. Real auth swaps to Supabase Auth + JWT.
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

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "super", name: "Salim Adams", role: "super_admin", roleLabel: "Super Admin", scope: "National", email: "demo@groundgame.app" },
  { key: "regional", name: "Efua Sarpong", role: "regional_coordinator", roleLabel: "Regional Coordinator", scope: "Greater Accra", email: "efua@groundgame.app", regionCode: "GAR" },
  { key: "constituency", name: "Naa Adjeley", role: "constituency_coordinator", roleLabel: "Constituency Coordinator", scope: "Greater Accra · Ablekuma North", email: "naa@groundgame.app", regionCode: "GAR", conCode: "GAR03" },
  { key: "analyst", name: "Yaw Donkor", role: "analyst", roleLabel: "Analyst", scope: "National (read-only)", email: "yaw@groundgame.app" },
  { key: "caller", name: "Kojo Mensah", role: "caller", roleLabel: "Caller", scope: "Greater Accra · Ablekuma North", email: "kojo@groundgame.app", regionCode: "GAR", conCode: "GAR03" },
];

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
