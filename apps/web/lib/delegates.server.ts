// Server-only loader for the real delegate roster. Reads from Supabase when the
// backend env is set (works on Vercel, PII stays in the DB), otherwise falls back
// to the gitignored local file for local dev. Never import from a client component.
import fs from "node:fs";
import path from "node:path";

export interface RealDelegate {
  position: string;
  name: string;
  contact: string | null;
}

type Store = Record<string, { region: string; constituency: string; delegates: RealDelegate[] }>;

let cache: Promise<Store> | undefined;

const keyOf = (region: string, constituency: string) => `${region}::${constituency.toLowerCase()}`;

// --- source 1: Supabase (preferred — available on the deployed app) -----------
async function fromSupabase(): Promise<Store | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/delegates?select=position,full_name,phone,constituencies(name,regions(name))&is_active=eq.true&limit=20000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      position: string;
      full_name: string;
      phone: string | null;
      constituencies: { name: string; regions: { name: string } | null } | null;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const store: Store = {};
    for (const r of rows) {
      const cname = r.constituencies?.name;
      const region = r.constituencies?.regions?.name;
      if (!cname || !region) continue;
      const k = keyOf(region, cname);
      (store[k] ??= { region, constituency: cname, delegates: [] }).delegates.push({
        position: r.position,
        name: r.full_name,
        contact: r.phone,
      });
    }
    return store;
  } catch {
    return null;
  }
}

// --- source 2: local gitignored file (local dev only) -------------------------
function fromFile(): Store | null {
  if (process.env.VERCEL) return null; // the file is never deployed; use Supabase
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "lib", "delegates.local.json"),
    path.join(cwd, "apps", "web", "lib", "delegates.local.json"),
    path.join(cwd, "..", "lib", "delegates.local.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")) as Store;
    } catch {
      /* try next */
    }
  }
  return null;
}

function getStore(): Promise<Store> {
  if (!cache) {
    cache = (async () => (await fromSupabase()) ?? fromFile() ?? {})();
    // Don't cache an empty result, so seeding Supabase later is picked up
    // without a redeploy.
    cache
      .then((s) => {
        if (Object.keys(s).length === 0) cache = undefined;
      })
      .catch(() => {
        cache = undefined;
      });
  }
  return cache;
}

export async function getRealDelegates(region: string, constituency: string): Promise<RealDelegate[]> {
  return (await getStore())[keyOf(region, constituency)]?.delegates ?? [];
}

/** Map of region::constituency(lower) -> delegate count, for the directory/badges. */
export async function getRosterCounts(): Promise<Record<string, number>> {
  const store = await getStore();
  return Object.fromEntries(Object.entries(store).map(([k, v]) => [k, v.delegates.length]));
}

export async function rosterStats(): Promise<{ constituencies: number; delegates: number }> {
  const store = await getStore();
  const vals = Object.values(store);
  return { constituencies: vals.length, delegates: vals.reduce((s, v) => s + v.delegates.length, 0) };
}

export const rosterKey = keyOf;
