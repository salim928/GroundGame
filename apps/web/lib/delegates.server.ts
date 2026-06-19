// Server-only loader for the real delegate roster (PII). Reads the gitignored
// delegates.local.json from disk at runtime. Absent on Vercel -> returns [] and
// the app falls back to synthesised data. Never import this from a client component.
import fs from "node:fs";
import path from "node:path";

export interface RealDelegate {
  position: string;
  name: string;
  contact: string | null;
}

type Store = Record<string, { region: string; constituency: string; delegates: RealDelegate[] }>;

let cache: Store | null | undefined;

function load(): Store | null {
  if (cache !== undefined) return cache;
  try {
    const p = path.join(process.cwd(), "lib", "delegates.local.json");
    cache = JSON.parse(fs.readFileSync(p, "utf8")) as Store;
  } catch {
    cache = null;
  }
  return cache;
}

export function getRealDelegates(region: string, constituency: string): RealDelegate[] {
  const store = load();
  if (!store) return [];
  return store[`${region}::${constituency.toLowerCase()}`]?.delegates ?? [];
}

/** Count of constituencies with a real roster — for a coverage badge. */
export function realRosterCount(): number {
  const store = load();
  return store ? Object.keys(store).length : 0;
}
