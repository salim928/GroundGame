// Server-only loader for the real delegate roster. Reads from Supabase when the
// backend env is set (works on Vercel, PII stays in the DB), otherwise falls back
// to the gitignored local file for local dev. Never import from a client component.
import fs from "node:fs";
import path from "node:path";

export interface RealDelegate {
  /** Supabase delegates.id when loaded from the DB (enables editing). Absent for the local file. */
  id?: string;
  position: string;
  name: string;
  contact: string | null;
}

type Store = Record<string, { region: string; constituency: string; delegates: RealDelegate[] }>;

let cache: Promise<Store> | undefined;
let cachedAt = 0;
// Short TTL so newly seeded/edited delegates appear without a redeploy.
const STORE_TTL_MS = 60_000;

const keyOf = (region: string, constituency: string) => `${region}::${constituency.toLowerCase()}`;

// --- source 1: Supabase (preferred — available on the deployed app) -----------
async function fromSupabase(): Promise<Store | null> {
  // URL falls back to the public one, so deploys only need the service-role secret.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/delegates?select=id,position,full_name,phone,constituencies(name,regions(name))&is_active=eq.true&limit=20000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      id: string;
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
        id: r.id,
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
  const stale = !cache || Date.now() - cachedAt > STORE_TTL_MS;
  if (stale) {
    cachedAt = Date.now();
    cache = (async () => (await fromSupabase()) ?? fromFile() ?? {})();
    // Don't cache an empty result, so seeding Supabase later is picked up
    // immediately rather than after the TTL.
    cache
      .then((s) => {
        if (Object.keys(s).length === 0) {
          cache = undefined;
          cachedAt = 0;
        }
      })
      .catch(() => {
        cache = undefined;
        cachedAt = 0;
      });
  }
  return cache!;
}

export async function getRealDelegates(region: string, constituency: string): Promise<RealDelegate[]> {
  return (await getStore())[keyOf(region, constituency)]?.delegates ?? [];
}

/** Map of region::constituency(lower) -> delegate count, for the directory/badges. */
export async function getRosterCounts(): Promise<Record<string, number>> {
  const store = await getStore();
  return Object.fromEntries(Object.entries(store).map(([k, v]) => [k, v.delegates.length]));
}

export async function getAllDelegates(): Promise<RealDelegate[]> {
  const store = await getStore();
  return Object.values(store).flatMap((v) => v.delegates);
}

export async function rosterStats(): Promise<{ constituencies: number; delegates: number }> {
  const store = await getStore();
  const vals = Object.values(store);
  return { constituencies: vals.length, delegates: vals.reduce((s, v) => s + v.delegates.length, 0) };
}

export interface CallStat {
  called: number;
  reached: number;
  supportive: number;
  undecided: number;
  opposed: number;
}

/**
 * Live call activity per constituency, aggregated from call_records (what callers
 * log). Returns {} when Supabase isn't reachable so the dashboard falls back to
 * zeros. Not cached — reflects new calls on the next page load.
 */
export async function getCallStats(): Promise<Record<string, CallStat>> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};
  try {
    const res = await fetch(
      `${url}/rest/v1/call_records?select=called,reached,outcome,delegates(constituencies(name,regions(name)))&limit=100000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return {};
    const rows = (await res.json()) as Array<{
      called: boolean;
      reached: boolean;
      outcome: string | null;
      delegates: { constituencies: { name: string; regions: { name: string } | null } | null } | null;
    }>;
    const out: Record<string, CallStat> = {};
    for (const r of rows) {
      const cname = r.delegates?.constituencies?.name;
      const region = r.delegates?.constituencies?.regions?.name;
      if (!cname || !region) continue;
      const k = keyOf(region, cname);
      const s = (out[k] ??= { called: 0, reached: 0, supportive: 0, undecided: 0, opposed: 0 });
      if (r.called) s.called += 1;
      if (r.reached) s.reached += 1;
      if (r.outcome === "supportive") s.supportive += 1;
      else if (r.outcome === "undecided") s.undecided += 1;
      else if (r.outcome === "hostile") s.opposed += 1;
    }
    return out;
  } catch {
    return {};
  }
}

export interface CallerStat {
  label: string;
  region: string;
  constituency: string;
  attempts: number;
  reached: number;
  supportive: number;
}

/** Per-caller activity aggregated from call_records.caller_label (what the caller
 *  console stamps on each logged call). Returns [] when Supabase isn't reachable. */
export async function getCallerStats(): Promise<CallerStat[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/call_records?select=caller_label,called,reached,outcome,delegates(constituencies(name,regions(name)))&caller_label=not.is.null&limit=100000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      caller_label: string | null;
      called: boolean;
      reached: boolean;
      outcome: string | null;
      delegates: { constituencies: { name: string; regions: { name: string } | null } | null } | null;
    }>;
    const byLabel: Record<string, CallerStat> = {};
    for (const r of rows) {
      const label = r.caller_label?.trim();
      if (!label) continue;
      const cname = r.delegates?.constituencies?.name ?? "";
      const region = r.delegates?.constituencies?.regions?.name ?? "";
      const s = (byLabel[label] ??= { label, region, constituency: cname, attempts: 0, reached: 0, supportive: 0 });
      if (!s.constituency && cname) s.constituency = cname;
      if (!s.region && region) s.region = region;
      if (r.called) s.attempts += 1;
      if (r.reached) s.reached += 1;
      if (r.outcome === "supportive") s.supportive += 1;
    }
    return Object.values(byLabel);
  } catch {
    return [];
  }
}

export interface DelegateCall {
  called: boolean;
  reached: boolean;
  outcome: string | null;
}

/** Live call status for specific delegates (by id), straight from call_records.
 *  Not cached, so the admin constituency view reflects callers' logging on reload. */
export async function getDelegateCalls(ids: string[]): Promise<Record<string, DelegateCall>> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || ids.length === 0) return {};
  try {
    const inList = ids.join(",");
    const res = await fetch(
      `${url}/rest/v1/call_records?delegate_id=in.(${inList})&select=delegate_id,called,reached,outcome`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return {};
    const rows = (await res.json()) as Array<{ delegate_id: string; called: boolean; reached: boolean; outcome: string | null }>;
    const out: Record<string, DelegateCall> = {};
    for (const r of rows) out[r.delegate_id] = { called: r.called, reached: r.reached, outcome: r.outcome };
    return out;
  } catch {
    return {};
  }
}

export const rosterKey = keyOf;
