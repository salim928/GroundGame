-- GroundGame — add the field "caller" role.
-- NOTE: Postgres forbids using a newly-added enum value in the SAME transaction
-- that adds it, so this is its own migration. Run it (and let it commit) BEFORE
-- 0004_caller_access.sql, which references 'caller' in policies.
alter type user_role add value if not exists 'caller';
