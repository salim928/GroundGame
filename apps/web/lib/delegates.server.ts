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

// Try several locations so it works regardless of where `next dev` was launched
// (apps/web cwd, monorepo-root cwd, or the standalone server output).
function candidatePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "lib", "delegates.local.json"),
    path.join(cwd, "apps", "web", "lib", "delegates.local.json"),
    path.join(cwd, "..", "lib", "delegates.local.json"),
  ];
}

function load(): Store | null {
  if (cache !== undefined) return cache;
  for (const p of candidatePaths()) {
    try {
      cache = JSON.parse(fs.readFileSync(p, "utf8")) as Store;
      return cache;
    } catch {
      /* try next */
    }
  }
  cache = null;
  return cache;
}

const keyOf = (region: string, constituency: string) => `${region}::${constituency.toLowerCase()}`;

export function getRealDelegates(region: string, constituency: string): RealDelegate[] {
  return load()?.[keyOf(region, constituency)]?.delegates ?? [];
}

export function getRealDelegateCount(region: string, constituency: string): number {
  return load()?.[keyOf(region, constituency)]?.delegates.length ?? 0;
}

/** Total constituencies with a real roster + total delegate count — for badges. */
export function rosterStats(): { constituencies: number; delegates: number } {
  const store = load();
  if (!store) return { constituencies: 0, delegates: 0 };
  const vals = Object.values(store);
  return { constituencies: vals.length, delegates: vals.reduce((s, v) => s + v.delegates.length, 0) };
}
