// Define and (optionally) provision the GroundGame dashboard logins.
//
// Always writes scripts/accounts.local.json (gitignored — contains passwords).
// If SUPABASE_SERVICE_ROLE_KEY + SUPABASE_URL are set, it also creates the
// Supabase Auth users and their profiles (role + region/constituency scope).
//
//   # generate credentials only (for the PDF):
//   node scripts/provision_users.mjs
//   # generate + create the accounts in Supabase:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/provision_users.mjs
import fs from "node:fs";
import crypto from "node:crypto";

const ACCOUNTS_FILE = "scripts/accounts.local.json";

// 10 accounts across the role levels. Scope is by region/constituency CODE.
const DEFS = [
  { name: "Salim Adams", email: "superadmin@groundgame.gh", role: "super_admin" },
  { name: "Efua Sarpong", email: "greateraccra.rc@groundgame.gh", role: "regional_coordinator", region: "GAR" },
  { name: "Kwabena Osei", email: "ashanti.rc@groundgame.gh", role: "regional_coordinator", region: "ASH" },
  { name: "Fuseini Mahama", email: "northern.rc@groundgame.gh", role: "regional_coordinator", region: "NOR" },
  { name: "Mawuli Agbeko", email: "volta.rc@groundgame.gh", role: "regional_coordinator", region: "VOL" },
  { name: "Naa Adjeley", email: "ablekuma.cc@groundgame.gh", role: "constituency_coordinator", region: "GAR", constituency: "GAR03" },
  { name: "Kofi Boateng", email: "bantama.cc@groundgame.gh", role: "constituency_coordinator", region: "ASH", constituency: "ASH18" },
  { name: "Ama Owusu", email: "effutu.cc@groundgame.gh", role: "constituency_coordinator", region: "CEN", constituency: "CEN11" },
  { name: "Yaw Donkor", email: "analyst@groundgame.gh", role: "analyst" },
  { name: "Adwoa Mensimah", email: "volta.analyst@groundgame.gh", role: "analyst", region: "VOL" },
];

// Strong, readable passwords (no ambiguous chars).
function password() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set, n) => Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join("");
  return `${pick(alpha, 6)}-${pick(digits, 4)}-${pick(alpha, 3)}`;
}

// Build (or reuse) the account list with passwords.
let accounts;
if (fs.existsSync(ACCOUNTS_FILE)) {
  accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
  console.log(`Reusing ${ACCOUNTS_FILE} (${accounts.length} accounts).`);
} else {
  accounts = DEFS.map((d) => ({ ...d, password: password() }));
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  console.log(`Wrote ${ACCOUNTS_FILE} (${accounts.length} accounts).`);
}

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.log("\nSUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — credentials generated only.");
  console.log("Re-run with both set to create the accounts in Supabase.");
  process.exit(0);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(path, init) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...H, ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Resolve region/constituency codes -> ids.
const regId = Object.fromEntries((await rest("/rest/v1/regions?select=id,code")).map((r) => [r.code, r.id]));
const conId = Object.fromEntries((await rest("/rest/v1/constituencies?select=id,code")).map((c) => [c.code, c.id]));

for (const a of accounts) {
  // Create the auth user (idempotent-ish: ignore "already registered").
  let userId;
  try {
    const user = await rest("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: a.email, password: a.password, email_confirm: true }),
    });
    userId = user.id;
  } catch (e) {
    // already exists -> look it up
    const list = await rest(`/auth/v1/admin/users?per_page=200`);
    const found = (list.users || list).find((u) => u.email === a.email);
    if (!found) throw e;
    userId = found.id;
    await rest(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password: a.password }) });
  }

  await rest("/rest/v1/profiles?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      full_name: a.name,
      role: a.role,
      region_id: a.region ? regId[a.region] ?? null : null,
      constituency_id: a.constituency ? conId[a.constituency] ?? null : null,
      is_active: true,
    }),
  });
  console.log(`  ✓ ${a.email}  (${a.role})`);
}
console.log(`\nProvisioned ${accounts.length} accounts in Supabase.`);
