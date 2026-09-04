-- recruit_001_core_down
-- Reverses recruit_001_core. DESTROYS every application, interview and audit
-- row. Take a dump first if any of it matters:
--   pg_dump -Fc fac_recruitment > before-rollback.dump
--
-- Dropped in dependency order; the extensions are left in place because other
-- things may rely on them and dropping them is not part of undoing this.

DROP TABLE IF EXISTS recruit_audit;
DROP TABLE IF EXISTS recruit_settings;
DROP TABLE IF EXISTS recruit_sessions;
DROP TABLE IF EXISTS recruit_availability_rules;
DROP TABLE IF EXISTS recruit_interviews;
DROP TABLE IF EXISTS recruit_applicants;
DROP TABLE IF EXISTS recruit_interviewers;

DROP TYPE IF EXISTS interview_status;
DROP TYPE IF EXISTS recruit_status;
DROP TYPE IF EXISTS recruit_role;
