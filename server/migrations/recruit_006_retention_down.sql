-- recruit_006_retention (down)
--
-- Removes the record of which CVs were deleted, and the retention period.
--
-- What it does NOT do is bring the files back. Anything the sweep has already
-- removed is gone from disk, and rolling this back only loses the note saying
-- so — leaving rows that look as though they still hold a CV when they do not.
--
-- Before rolling back, keep the list:
--
--   \copy (SELECT id, email, cv_filename, cv_deleted_at FROM recruit_applicants
--          WHERE cv_deleted_at IS NOT NULL) TO 'deleted-cvs.csv' CSV HEADER

BEGIN;

DROP INDEX IF EXISTS idx_recruit_applicants_cv_sweep;
ALTER TABLE recruit_applicants DROP COLUMN IF EXISTS cv_deleted_at;

DELETE FROM recruit_settings WHERE key = 'retention.declined_cv_months';

COMMIT;
