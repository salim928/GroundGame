-- GroundGame — initial schema (Build Spec Section 6)
-- Postgres 15 / Supabase. The DB is the analytical source of truth, not the Sheets.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('super_admin','regional_coordinator','constituency_coordinator','analyst');
exception when duplicate_object then null; end $$;

do $$ begin
  create type call_outcome as enum ('supportive','undecided','hostile','wrong_number');
exception when duplicate_object then null; end $$;

do $$ begin
  create type call_source as enum ('sheet','app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scope_type as enum ('national','region','constituency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conflict_status as enum ('open','resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sync_status as enum ('running','success','partial','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delegate_type as enum ('former_exec','current_exec','aspiring_exec','influencer','member');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Hierarchy
-- ---------------------------------------------------------------------------
create table if not exists regions (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null
);

create table if not exists constituencies (
  id              uuid primary key default gen_random_uuid(),
  region_id       uuid not null references regions(id) on delete cascade,
  name            text not null,
  code            text unique not null,
  sheet_id        text,
  target_contacts int  not null default 10,
  sync_enabled    boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists branches (
  id              uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies(id) on delete cascade,
  name            text not null,
  code            text not null,
  unique (constituency_id, code)
);

create table if not exists delegates (
  id              uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  external_ref    text unique not null,           -- immutable Sheet join key (Section 6.1)
  full_name       text not null,
  phone           text,
  delegate_type   delegate_type,
  position        text,
  is_influencer   boolean not null default false,
  is_active       boolean not null default true,  -- soft delete preserves analytics
  created_at      timestamptz not null default now()
);
create index if not exists delegates_constituency_idx on delegates(constituency_id);
create index if not exists delegates_branch_idx on delegates(branch_id);

-- ---------------------------------------------------------------------------
-- Identity & access
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  role            user_role not null default 'analyst',
  region_id       uuid references regions(id) on delete set null,
  constituency_id uuid references constituencies(id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  scope_type    scope_type not null,
  scope_id      uuid,                              -- region_id or constituency_id depending on scope_type
  sheet_shared  boolean not null default false,
  invited_email text,                              -- caller's Google email (callers have no login)
  created_at    timestamptz not null default now()
);
create index if not exists assignments_scope_idx on assignments(scope_type, scope_id);

-- ---------------------------------------------------------------------------
-- Call data
-- ---------------------------------------------------------------------------
create table if not exists call_records (
  id           uuid primary key default gen_random_uuid(),
  delegate_id  uuid unique not null references delegates(id) on delete cascade,
  caller_label text,
  called       boolean not null default false,
  reached      boolean not null default false,
  outcome      call_outcome,                       -- single-valued; null = not captured
  callback_at  timestamptz,
  notes        text,
  contacted_at timestamptz,
  source       call_source not null default 'sheet',
  updated_at   timestamptz not null default now()
);

create table if not exists conflicts (
  id          uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references delegates(id) on delete cascade,
  raw_flags   jsonb not null,                       -- the clashing ticks captured from the Sheet
  status      conflict_status not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists conflicts_status_idx on conflicts(status);

create table if not exists sync_runs (
  id              uuid primary key default gen_random_uuid(),
  constituency_id uuid references constituencies(id) on delete cascade,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          sync_status not null default 'running',
  rows_pulled     int not null default 0,
  rows_written    int not null default 0,
  conflicts_found int not null default 0,
  error           text
);
create index if not exists sync_runs_constituency_idx on sync_runs(constituency_id, started_at desc);

create table if not exists audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  meta       jsonb,
  created_at timestamptz not null default now()
);

-- Projection weights + classification thresholds — editable without redeploy (Section 3.2)
create table if not exists app_config (
  key   text primary key,
  value jsonb not null
);

insert into app_config(key, value) values
  ('projection_weights', '{"supportive":1.0,"undecided":0.35,"not_reached":0.15,"opposed":0.0}'::jsonb),
  ('classification_thresholds', '{"stronghold":0.65,"lean":0.55,"tossup":0.45,"weak":0.0}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Row-Level Security (Section 7) — scope enforced at the DB; API guards are layer two.
-- ---------------------------------------------------------------------------
alter table regions        enable row level security;
alter table constituencies enable row level security;
alter table branches       enable row level security;
alter table delegates      enable row level security;
alter table call_records   enable row level security;
alter table conflicts      enable row level security;
alter table profiles       enable row level security;
alter table assignments    enable row level security;
alter table sync_runs      enable row level security;
alter table audit_logs     enable row level security;
alter table app_config     enable row level security;

-- Helper functions read the caller's profile scope from the JWT-bound auth.uid().
create or replace function gg_role() returns user_role language sql stable as $$
  select role from profiles where user_id = auth.uid();
$$;

create or replace function gg_region() returns uuid language sql stable as $$
  select region_id from profiles where user_id = auth.uid();
$$;

create or replace function gg_constituency() returns uuid language sql stable as $$
  select constituency_id from profiles where user_id = auth.uid();
$$;

-- A constituency is "in scope" for the current user.
create or replace function gg_can_see_constituency(c_id uuid) returns boolean language sql stable as $$
  select case gg_role()
    when 'super_admin' then true
    when 'analyst'     then true   -- read-only; scope configurable, default national read
    when 'regional_coordinator' then exists (
      select 1 from constituencies c where c.id = c_id and c.region_id = gg_region())
    when 'constituency_coordinator' then c_id = gg_constituency()
    else false
  end;
$$;

-- Profiles: a user can always read their own profile; super_admin reads all.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (
  user_id = auth.uid() or gg_role() = 'super_admin'
);

-- Regions: visible to all authenticated dashboard users.
drop policy if exists regions_read on regions;
create policy regions_read on regions for select using (auth.uid() is not null);

-- Constituencies / branches / delegates / call data: scoped.
drop policy if exists constituencies_read on constituencies;
create policy constituencies_read on constituencies for select using (gg_can_see_constituency(id));

drop policy if exists branches_read on branches;
create policy branches_read on branches for select using (gg_can_see_constituency(constituency_id));

drop policy if exists delegates_read on delegates;
create policy delegates_read on delegates for select using (gg_can_see_constituency(constituency_id));

drop policy if exists call_records_read on call_records;
create policy call_records_read on call_records for select using (
  exists (select 1 from delegates d where d.id = delegate_id and gg_can_see_constituency(d.constituency_id))
);

drop policy if exists conflicts_read on conflicts;
create policy conflicts_read on conflicts for select using (
  exists (select 1 from delegates d where d.id = delegate_id and gg_can_see_constituency(d.constituency_id))
);

-- app_config: readable by all dashboard users; writes go through the service role only.
drop policy if exists app_config_read on app_config;
create policy app_config_read on app_config for select using (auth.uid() is not null);

-- Note: privileged writes (upload, sync, resolution, role change) are performed by the
-- NestJS API using the Supabase service role, which bypasses RLS by design.
