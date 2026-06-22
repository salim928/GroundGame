-- Fix RLS infinite recursion on profiles.
--
-- profiles_self USING clause calls gg_role(), and gg_role() selects from profiles,
-- which re-applies profiles_self -> "infinite recursion detected in policy for
-- relation profiles". The client profile lookup then errors and the app falls back
-- to the default role (analyst) for EVERYONE — so callers/coordinators were being
-- treated as analysts.
--
-- Fix: make the scope helpers SECURITY DEFINER so they read profiles/constituencies
-- as the function owner, bypassing RLS and breaking the recursion. (They only read
-- the current user's own scope via auth.uid(), so this is safe.)

create or replace function gg_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid();
$$;

create or replace function gg_region() returns uuid
  language sql stable security definer set search_path = public as $$
  select region_id from profiles where user_id = auth.uid();
$$;

create or replace function gg_constituency() returns uuid
  language sql stable security definer set search_path = public as $$
  select constituency_id from profiles where user_id = auth.uid();
$$;

create or replace function gg_can_see_constituency(c_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select case gg_role()
    when 'super_admin' then true
    when 'analyst'     then true
    when 'regional_coordinator' then exists (
      select 1 from constituencies c where c.id = c_id and c.region_id = gg_region())
    when 'constituency_coordinator' then c_id = gg_constituency()
    when 'caller' then c_id = gg_constituency()
    else false
  end;
$$;

create or replace function gg_can_log_calls(c_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select case gg_role()
    when 'super_admin' then true
    when 'regional_coordinator' then exists (
      select 1 from constituencies c where c.id = c_id and c.region_id = gg_region())
    when 'constituency_coordinator' then c_id = gg_constituency()
    when 'caller' then c_id = gg_constituency()
    else false
  end;
$$;

-- verify (run as an authenticated user): select gg_role();
