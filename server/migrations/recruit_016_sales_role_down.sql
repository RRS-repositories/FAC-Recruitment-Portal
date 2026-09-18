-- Undo recruit_016.
--
-- REFUSES while any sales application exists. Dropping these columns would
-- throw away where each candidate's voice note is stored and everything they
-- told us on the details step, while leaving the rows themselves behind as
-- applications nobody can assess -- and the recordings on disk with nothing
-- pointing at them. That has to be a decision somebody makes knowingly, after
-- exporting what they need, so this stops and says so.
--
-- Compared as text, not as the enum: `role = 'sa_sales'` would fail outright
-- on a database where the value was never added, and this guard must still
-- run there.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM recruit_applicants WHERE role::text = 'sa_sales') THEN
    RAISE EXCEPTION
      'recruit_016 down refused: % sales application(s) exist. Export them, and their voice notes, before rolling back.',
      (SELECT count(*) FROM recruit_applicants WHERE role::text = 'sa_sales');
  END IF;
END
$guard$;

ALTER TABLE recruit_applicants DROP CONSTRAINT IF EXISTS recruit_applicants_voice_source_check;
ALTER TABLE recruit_applicants
  DROP COLUMN IF EXISTS voice_deleted_at,
  DROP COLUMN IF EXISTS voice_source,
  DROP COLUMN IF EXISTS voice_duration_sec,
  DROP COLUMN IF EXISTS voice_size_bytes,
  DROP COLUMN IF EXISTS voice_mime,
  DROP COLUMN IF EXISTS voice_filename,
  DROP COLUMN IF EXISTS voice_object_key,
  DROP COLUMN IF EXISTS profile;

-- The 'sa_sales' value STAYS in recruit_role. PostgreSQL has no
-- ALTER TYPE ... DROP VALUE; removing one means recreating the type and
-- rewriting every column that uses it, which is a far bigger and riskier
-- change than the one being undone. An unused enum value is harmless: with
-- the code rolled back, nothing can submit it, and the guard above has
-- already proved no row holds it. Re-applying recruit_016 afterwards is safe,
-- because its ADD VALUE is IF NOT EXISTS.
--
-- recruit_sessions rows opened by the sales form but never completed (role
-- 'sa_sales', no applicant) are left alone. They are not applications, and a
-- rollback is not the place to decide what happens to them; the enum value
-- they hold is the one this file keeps.
