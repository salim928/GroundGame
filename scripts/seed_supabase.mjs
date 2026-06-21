// Seed a Supabase project with the real region/constituency hierarchy and the
// extracted delegate rosters. PII (names + phones) goes from your LOCAL file
// straight into YOUR database — it is never committed to Git.
//
// Prereqs: run supabase/migrations/0001_init.sql and 0002_seed_hierarchy.sql first
// (or this script will upsert regions/constituencies too).
//
// Usage (from repo root):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/seed_supabase.mjs
import fs from "node:fs";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function upsert(table, rows, onConflict) {
  if (rows.length === 0) return [];
  const res = await fetch(`${URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table} upsert ${res.status}: ${await res.text()}`);
  return res.json();
}
async function select(table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers: H });
  if (!res.ok) throw new Error(`${table} select ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- load local source data ---------------------------------------------------
const ts = fs.readFileSync("apps/web/lib/hierarchy.ts", "utf8");
const regions = JSON.parse(ts.slice(ts.indexOf("= [") + 2, ts.lastIndexOf("]") + 1));
const del = JSON.parse(fs.readFileSync("apps/web/lib/delegates.local.json", "utf8"));

// --- 1) regions ---------------------------------------------------------------
await upsert("regions", regions.map((r) => ({ name: r.name, code: r.code })), "code");
const regId = Object.fromEntries((await select("regions", "select=id,code")).map((r) => [r.code, r.id]));
console.log(`regions: ${regions.length}`);

// --- 2) constituencies --------------------------------------------------------
const cons = regions.flatMap((r) =>
  r.constituencies.map((c) => ({ region_id: regId[r.code], name: c.name, code: c.code, target_contacts: 10 })),
);
await upsert("constituencies", cons, "code");
const conId = Object.fromEntries((await select("constituencies", "select=id,code")).map((c) => [c.code, c.id]));
console.log(`constituencies: ${cons.length}`);

// --- 3) delegates -------------------------------------------------------------
const nameToCode = {};
for (const r of regions) for (const c of r.constituencies) nameToCode[`${r.name}::${c.name.toLowerCase()}`] = c.code;

const rows = [];
for (const [key, v] of Object.entries(del)) {
  const code = nameToCode[key];
  if (!code || !conId[code]) continue;
  v.delegates.forEach((d, i) => {
    rows.push({
      constituency_id: conId[code],
      external_ref: `${code}-${String(i + 1).padStart(3, "0")}`,
      full_name: d.name,
      phone: d.contact || null,
      position: d.position,
      is_active: true,
    });
  });
}

for (let i = 0; i < rows.length; i += 500) {
  await upsert("delegates", rows.slice(i, i + 500), "external_ref");
  process.stdout.write(`  delegates ${Math.min(i + 500, rows.length)}/${rows.length}\r`);
}
console.log(`\nSeeded ${regions.length} regions, ${cons.length} constituencies, ${rows.length} delegates.`);
