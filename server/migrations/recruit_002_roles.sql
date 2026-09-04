-- recruit_002_roles
-- Privileges for the application role.
--
-- The role name comes from PGUSER. This migration grants it the narrowest set
-- that still lets the portal work, so that a bug — or a compromise of the
-- public application endpoint — cannot rewrite history or delete evidence.
--
-- Run as a superuser. `:app_role` is supplied by the migration runner, which
-- reads it from PGUSER, so the same file works in dev and production without
-- a hardcoded name.

GRANT USAGE ON SCHEMA public TO :"app_role";

-- Ordinary working tables: full access.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  recruit_applicants,
  recruit_interviews,
  recruit_sessions
TO :"app_role";

-- Configuration: readable by the app, changed through the settings screen.
GRANT SELECT, INSERT, UPDATE ON
  recruit_interviewers,
  recruit_availability_rules,
  recruit_settings
TO :"app_role";

-- Audit is append-only. No UPDATE, no DELETE — spec §3 requires this, and it
-- is the difference between a log and a story. If the app cannot rewrite it,
-- nobody using the app can either.
GRANT SELECT, INSERT ON recruit_audit TO :"app_role";

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";

-- Nothing created later should silently be more permissive than the above.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
