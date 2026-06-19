// Derives the public region -> constituency hierarchy from the local
// "constituency conference" folder (region folders, one file per constituency)
// and writes apps/web/lib/hierarchy.ts. Only names are emitted — no delegate PII.
//
// Run from repo root:  node scripts/build-hierarchy.mjs
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "constituency conference";
const OUT = "apps/web/lib/hierarchy.ts";

// Folder name -> display name + code.
const REGION_META = {
  AHAFO: { name: "Ahafo", code: "AHA" },
  ASHANTI: { name: "Ashanti", code: "ASH" },
  BONO: { name: "Bono", code: "BON" },
  "BONO EAST": { name: "Bono East", code: "BOE" },
  CENTRAL: { name: "Central", code: "CEN" },
  "EASTERN REGION": { name: "Eastern", code: "EAS" },
  GAR: { name: "Greater Accra", code: "GAR" },
  "NORTH EAST": { name: "North East", code: "NEA" },
  "NORTHERN REGION": { name: "Northern", code: "NOR" },
  OTI: { name: "Oti", code: "OTI" },
  SAVANNA: { name: "Savannah", code: "SAV" },
  "UPPER EAST": { name: "Upper East", code: "UPE" },
  "UPPER WEST": { name: "Upper West", code: "UPW" },
  VOLTA: { name: "Volta", code: "VOL" },
  WESTERN: { name: "Western", code: "WES" },
  "WESTRN NORTH": { name: "Western North", code: "WEN" },
};

// Regions whose folder holds only a combined "Complete" conference doc (no
// per-constituency files). Names are the public EC constituency list those
// documents cover (confirmed against the docx text). No delegate PII included.
const FALLBACK = {
  BONO: [
    "Banda", "Berekum East", "Berekum West", "Dormaa Central", "Dormaa East",
    "Dormaa West", "Jaman North", "Jaman South", "Sunyani East", "Sunyani West",
    "Tain", "Wenchi",
  ],
  "UPPER WEST": [
    "Daffiama Bussie Issa", "Jirapa", "Lambussie Karni", "Lawra", "Nadowli Kaleo",
    "Nandom", "Sissala East", "Sissala West", "Wa Central", "Wa East", "Wa West",
  ],
};

// Region suffixes that appear inside file names (e.g. "ASANTE AKIM - Ashanti").
const SUFFIXES = [
  "ahafo", "ashanti", "bono east", "bono", "central", "eastern", "accra", "gar",
  "north east", "northern", "oti", "savanna", "savannah", "upper east", "upper west",
  "volta", "western north", "western",
];

function cleanConstituency(file) {
  let n = file.replace(/\.[^.]+$/, ""); // drop extension
  n = n.replace(/[–—]/g, "-"); // normalise dashes
  // strip a trailing " - Region" / " -Region" / "- Region" segment
  n = n.replace(/[\s-]+(?:ahafo|ashanti|bono east|bono|central|eastern|accra|gar|north east|northern|oti|savanna(?:h)?|upper east|upper west|volta|western north|western)\s*$/i, "");
  n = n.replace(/[\s-]+$/, "").replace(/\s{2,}/g, " ").trim();
  // Title-case while preserving common ALLCAPS words sensibly
  n = n
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return n;
}

function codeFor(regionCode, i) {
  return `${regionCode}${String(i + 1).padStart(2, "0")}`;
}

const regions = [];
for (const dir of readdirSync(SRC).sort()) {
  const full = join(SRC, dir);
  if (!statSync(full).isDirectory()) continue;
  const meta = REGION_META[dir] ?? { name: dir, code: dir.slice(0, 3).toUpperCase() };

  const seen = new Set();
  const constituencies = [];
  for (const file of readdirSync(full).sort()) {
    if (file.startsWith("~$")) continue; // Word temp lock files
    if (!statSync(join(full, file)).isFile()) continue;
    let name = cleanConstituency(file);
    if (!name || /complete/i.test(name)) continue; // skip combined/region-level docs
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    constituencies.push(name);
  }
  // Fall back to the public list for regions with only a combined doc.
  if (constituencies.length === 0 && FALLBACK[dir]) {
    constituencies.push(...FALLBACK[dir]);
  }
  if (constituencies.length === 0) continue;
  regions.push({
    name: meta.name,
    code: meta.code,
    constituencies: constituencies.map((name, i) => ({ name, code: codeFor(meta.code, i) })),
  });
}

const total = regions.reduce((s, r) => s + r.constituencies.length, 0);

const header = `// AUTO-GENERATED from the "constituency conference" dataset by scripts/build-hierarchy.mjs.
// Public region/constituency names only — no delegate PII. Do not edit by hand.
// Regions: ${regions.length} · Constituencies: ${total}

export interface HierConstituency {
  name: string;
  code: string;
}
export interface HierRegion {
  name: string;
  code: string;
  constituencies: HierConstituency[];
}

export const REAL_HIERARCHY: HierRegion[] = ${JSON.stringify(regions, null, 2)};
`;

writeFileSync(OUT, header);

// Also emit a Supabase seed (regions + constituencies; names only, no PII).
const sqlEsc = (s) => s.replace(/'/g, "''");
const regionRows = regions.map((r) => `  ('${sqlEsc(r.name)}', '${r.code}')`).join(",\n");
const conRows = regions
  .flatMap((r) => r.constituencies.map((c) => `  ('${c.code}', '${sqlEsc(c.name)}', '${r.code}')`))
  .join(",\n");
const sql = `-- AUTO-GENERATED by scripts/build-hierarchy.mjs from the constituency conference dataset.
-- Public region/constituency names only — no delegate PII. ${regions.length} regions, ${total} constituencies.

insert into regions (name, code) values
${regionRows}
on conflict (code) do nothing;

insert into constituencies (region_id, name, code, target_contacts)
select r.id, v.name, v.code, 10
from (values
${conRows}
) as v(code, name, rcode)
join regions r on r.code = v.rcode
on conflict (code) do nothing;
`;
writeFileSync("supabase/migrations/0002_seed_hierarchy.sql", sql);

console.log(`Wrote ${OUT} + supabase/migrations/0002_seed_hierarchy.sql: ${regions.length} regions, ${total} constituencies`);
for (const r of regions) console.log(`  ${r.name} (${r.code}): ${r.constituencies.length}`);
