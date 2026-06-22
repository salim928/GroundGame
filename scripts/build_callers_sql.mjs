// Generate SQL to create field-caller logins assigned to a single constituency
// each (auth.users + auth.identities + profiles). No service-role key needed —
// paste the output into the Supabase SQL editor and Run.
//
// Prereqs: migrations 0001, 0002, 0003 (caller role), 0004 must be applied.
// Output (gitignored, contains passwords): supabase/seed_callers.local.sql
//
//   node scripts/build_callers_sql.mjs
import fs from "node:fs";
import crypto from "node:crypto";

// name, email (their login), and the constituency CODE to scope them to.
const CALLERS = [
  { name: "Kojo Mensah", email: "ablekuma.caller@groundgame.gh", constituency: "GAR03", conName: "Ablekuma Central", region: "Greater Accra" },
  { name: "Abena Nyarko", email: "bantama.caller@groundgame.gh", constituency: "ASH18", conName: "Bantama", region: "Ashanti" },
];

function password() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set, n) => Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join("");
  return `${pick(alpha, 6)}-${pick(digits, 4)}-${pick(alpha, 3)}`;
}
const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;

const accounts = CALLERS.map((c) => ({ ...c, password: password() }));

const blocks = accounts.map((a) => `-- caller: ${a.email}  ->  ${a.region} · ${a.conName} (${a.constituency})
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       ${esc(a.email)}, crypt(${esc(a.password)}, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', ${esc(a.name)}), now(), now(),
       '', '', '', '', '', '', '', ''
where not exists (select 1 from auth.users where email = ${esc(a.email)});

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select ${esc(a.email)}, u.id,
       jsonb_build_object('sub', u.id::text, 'email', ${esc(a.email)}, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email = ${esc(a.email)}
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into profiles (user_id, full_name, role, region_id, constituency_id, is_active)
select u.id, ${esc(a.name)}, 'caller'::user_role,
       (select region_id from constituencies where code = ${esc(a.constituency)}),
       (select id from constituencies where code = ${esc(a.constituency)}),
       true
from auth.users u
where u.email = ${esc(a.email)}
on conflict (user_id) do update
  set full_name = excluded.full_name, role = excluded.role,
      region_id = excluded.region_id, constituency_id = excluded.constituency_id, is_active = true;`);

const sql = `-- AUTO-GENERATED caller seed (CONTAINS PASSWORDS) — do NOT commit.
-- Prereqs: 0001_init, 0002_seed_hierarchy, 0003_caller_role, 0004_caller_access applied.
-- Paste into the Supabase SQL editor and Run.

${blocks.join("\n\n")}

-- verify:
-- select p.full_name, p.role, r.name region, c.name constituency, u.email
-- from profiles p join auth.users u on u.id = p.user_id
-- left join constituencies c on c.id = p.constituency_id
-- left join regions r on r.id = p.region_id
-- where p.role = 'caller';
`;

fs.writeFileSync("supabase/seed_callers.local.sql", sql);
console.log("Wrote supabase/seed_callers.local.sql\n");
console.log("Credentials (store securely — passwords are not recoverable later):\n");
for (const a of accounts) {
  console.log(`  ${a.region} · ${a.conName}`);
  console.log(`    email:    ${a.email}`);
  console.log(`    password: ${a.password}\n`);
}
