-- Undo recruit_017.
--
-- REFUSES while any AI Developer application exists. With the code rolled
-- back, nothing could show, decide or email those candidates: the rows would
-- sit in the dashboard as applications nobody can assess, with their details
-- step in a `profile` nothing reads. That has to be a decision somebody makes
-- knowingly, after exporting what they need, so this stops and says so.
--
-- Compared as text, not as the enum: `role = 'india_aidev'` would fail
-- outright on a database where the value was never added, and this guard must
-- still run there.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM recruit_applicants WHERE role::text = 'india_aidev') THEN
    RAISE EXCEPTION
      'recruit_017 down refused: % AI Developer application(s) exist. Export them before rolling back.',
      (SELECT count(*) FROM recruit_applicants WHERE role::text = 'india_aidev');
  END IF;
END
$guard$;

-- That is the whole rollback. recruit_017 added one enum value and nothing
-- else, and the value STAYS in recruit_role: PostgreSQL has no
-- ALTER TYPE ... DROP VALUE; removing one means recreating the type and
-- rewriting every column that uses it, which is a far bigger and riskier
-- change than the one being undone. An unused enum value is harmless: with
-- the code rolled back, nothing can submit it, and the guard above has
-- already proved no application holds it. Re-applying recruit_017 afterwards
-- is safe, because its ADD VALUE is IF NOT EXISTS.
--
-- The `profile` column is recruit_016's and is left alone: the sales role
-- uses it too, and it is that migration's to remove.
--
-- recruit_sessions rows opened by the AI Developer form but never completed
-- (role 'india_aidev', no applicant) are left alone. They are not
-- applications, and a rollback is not the place to decide what happens to
-- them; the enum value they hold is the one this file keeps.
