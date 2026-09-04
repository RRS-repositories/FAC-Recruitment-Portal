-- atlas_enquiries_001_down
-- Reverses atlas_enquiries_001. Confined entirely to the `atlas` cluster; the
-- CRM's `main` cluster is not referenced and cannot be affected by this file.
--
-- This DROPS captured enquiries. Take a dump first if the data matters:
--   pg_dump -p 5434 -Fc atlas_recruitment > atlas-before-rollback.dump

DROP INDEX IF EXISTS idx_atlas_enquiries_unnotified;
DROP INDEX IF EXISTS idx_atlas_enquiries_email_lower;
DROP INDEX IF EXISTS idx_atlas_enquiries_created_at;
DROP TABLE IF EXISTS atlas_enquiries;
