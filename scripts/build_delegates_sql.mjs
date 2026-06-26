// Generate a SQL seed for the delegate rosters that can be pasted into the
// Supabase SQL editor (no service-role key / command line needed to load data).
// Output is GITIGNORED — it contains PII and must never be committed.
//
// Run from repo root:  node scripts/build_delegates_sql.mjs
import fs from "node:fs";

const OUT = "supabase/seed_delegates.local.sql";
const ts = fs.readFileSync("apps/web/lib/hierarchy.ts", "utf8");
const regions = JSON.parse(ts.slice(ts.indexOf("= [") + 2, ts.lastIndexOf("]") + 1));
const del = JSON.parse(fs.readFileSync("apps/web/lib/delegates.local.json", "utf8"));

const nameToCode = {};
for (const r of regions) for (const c of r.constituencies) nameToCode[`${r.name}::${c.name.toLowerCase()}`] = c.code;

const esc = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

const rows = [];
for (const [key, v] of Object.entries(del)) {
  const code = nameToCode[key];
  if (!code) continue;
  v.delegates.forEach((d, i) => {
    const ext = `${code}-${String(i + 1).padStart(3, "0")}`;
    rows.push(`  (${esc(ext)}, ${esc(code)}, ${esc(d.name)}, ${d.contact ? esc(d.contact) : "null"}, ${esc(d.position)})`);
  });
}

// Batch into chunks so the editor handles each statement comfortably.
const chunks = [];
for (let i = 0; i < rows.length; i += 400) chunks.push(rows.slice(i, i + 400));

const body = chunks
  .map(
    (chunk) => `insert into delegates (constituency_id, external_ref, full_name, phone, position, is_active)
select c.id, v.ext, v.name, v.phone, v.position, true
from (values
${chunk.join(",\n")}
) as v(ext, code, name, phone, position)
join constituencies c on c.code = v.code
on conflict (external_ref) do nothing;`,
  )
  .join("\n\n");

const sql = `-- AUTO-GENERATED delegate roster seed (PII) — do NOT commit.
-- Prereq: run 0001_init.sql and 0002_seed_hierarchy.sql first.
-- ${rows.length} delegates across the seeded constituencies.
--
-- CLEAN RELOAD: this clears the existing roster first so the upload is exact
-- (no stale rows from a previous, smaller extraction). NOTE: deleting delegates
-- cascades to call_records, so any logged test calls are cleared too.
delete from delegates;

${body}
`;

fs.writeFileSync(OUT, sql);
console.log(`Wrote ${OUT}: ${rows.length} delegate rows in ${chunks.length} statement(s).`);
