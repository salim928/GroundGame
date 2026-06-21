-- GroundGame — caller access (Build Spec Section 7, extended for in-app callers).
-- Run AFTER 0003_caller_role.sql has committed.
--
-- A caller logs in to the app and sees ONLY the delegates of the single
-- constituency they're assigned to (profiles.constituency_id), and may log call
-- outcomes for those delegates. Coordinators may log calls within their scope.
-- Analysts stay read-only. Enforcement is at the DB via RLS — the app reads/writes
-- the caller console with the caller's own JWT, so this is the real boundary.

-- Callers are scoped exactly like a constituency coordinator for READS.
create or replace function gg_can_see_constituency(c_id uuid) returns boolean language sql stable as $$
  select case gg_role()
    when 'super_admin' then true
    when 'analyst'     then true   -- read-only; default national read
    when 'regional_coordinator' then exists (
      select 1 from constituencies c where c.id = c_id and c.region_id = gg_region())
    when 'constituency_coordinator' then c_id = gg_constituency()
    when 'caller' then c_id = gg_constituency()
    else false
  end;
$$;

-- WHO may log/edit a call outcome (writes). Analyst excluded (read-only).
create or replace function gg_can_log_calls(c_id uuid) returns boolean language sql stable as $$
  select case gg_role()
    when 'super_admin' then true
    when 'regional_coordinator' then exists (
      select 1 from constituencies c where c.id = c_id and c.region_id = gg_region())
    when 'constituency_coordinator' then c_id = gg_constituency()
    when 'caller' then c_id = gg_constituency()
    else false
  end;
$$;

-- call_records: insert + update for delegates in the writer's scope.
drop policy if exists call_records_insert on call_records;
create policy call_records_insert on call_records for insert with check (
  exists (select 1 from delegates d where d.id = delegate_id and gg_can_log_calls(d.constituency_id))
);

drop policy if exists call_records_update on call_records;
create policy call_records_update on call_records for update using (
  exists (select 1 from delegates d where d.id = delegate_id and gg_can_log_calls(d.constituency_id))
) with check (
  exists (select 1 from delegates d where d.id = delegate_id and gg_can_log_calls(d.constituency_id))
);

-- verify:
-- select gg_role(), gg_constituency();
