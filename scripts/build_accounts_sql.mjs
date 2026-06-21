// Generate SQL to seed the 10 dashboard accounts (auth.users + auth.identities
// + profiles) directly in the Supabase SQL editor — no service-role key needed.
// Reads scripts/accounts.local.json. Output (gitignored, contains passwords):
//   supabase/seed_accounts.local.sql
//
// Run from repo root:  node scripts/build_accounts_sql.mjs
import fs from "node:fs";

const accounts = JSON.parse(fs.readFileSync("scripts/accounts.local.json", "utf8"));
const esc = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

const blocks = accounts.map((a) => {
  const region = a.region ? `(select id from regions where code = ${esc(a.region)})` : "null";
  const con = a.constituency ? `(select id from constituencies where code = ${esc(a.constituency)})` : "null";
  return `-- ${a.role}: ${a.email}
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
select u.id, ${esc(a.name)}, ${esc(a.role)}::user_role, ${region}, ${con}, true
from auth.users u
where u.email = ${esc(a.email)}
on conflict (user_id) do update
  set full_name = excluded.full_name, role = excluded.role,
      region_id = excluded.region_id, constituency_id = excluded.constituency_id, is_active = true;`;
});

const sql = `-- AUTO-GENERATED account seed (CONTAINS PASSWORDS) — do NOT commit.
-- Prereq: run 0001_init.sql, 0002_seed_hierarchy.sql first.
-- Paste into the Supabase SQL editor and Run. Creates ${accounts.length} login accounts.
-- Passwords are bcrypt-hashed at insert via pgcrypto's crypt()/gen_salt('bf').

${blocks.join("\n\n")}

-- Repair any rows created earlier with NULL token columns (fixes
-- "Database error querying schema" on login).
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@groundgame.gh';

-- verify:
-- select p.full_name, p.role, u.email from profiles p join auth.users u on u.id = p.user_id order by p.role;
`;

fs.writeFileSync("supabase/seed_accounts.local.sql", sql);
console.log(`Wrote supabase/seed_accounts.local.sql for ${accounts.length} accounts.`);
