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
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "super", name: "Salim Adams", role: "super_admin", roleLabel: "Super Admin", scope: "National", email: "demo@groundgame.app" },
  { key: "regional", name: "Efua Sarpong", role: "regional_coordinator", roleLabel: "Regional Coordinator", scope: "Greater Accra", email: "efua@groundgame.app" },
  { key: "constituency", name: "Naa Adjeley", role: "constituency_coordinator", roleLabel: "Constituency Coordinator", scope: "Greater Accra 1", email: "naa@groundgame.app" },
  { key: "analyst", name: "Yaw Donkor", role: "analyst", roleLabel: "Analyst", scope: "National (read-only)", email: "yaw@groundgame.app" },
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
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
