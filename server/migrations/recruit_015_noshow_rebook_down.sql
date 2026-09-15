-- Undo recruit_015.
--
-- REFUSES rather than destroying a record. If anybody has been put on the
-- do-not-rehire list, dropping these columns would silently forget that a
-- candidate was told, in writing, that they will not be considered again --
-- and the next application from them would be treated as a fresh one. That
-- has to be a decision somebody makes knowingly, so this stops and says so.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM recruit_applicants WHERE do_not_rehire) THEN
    RAISE EXCEPTION
      'recruit_015 down refused: % applicant(s) are on the do-not-rehire list. Export that list before rolling back.',
      (SELECT count(*) FROM recruit_applicants WHERE do_not_rehire);
  END IF;
END
$guard$;

DELETE FROM recruit_settings WHERE key = 'flags.recruitment_noshow_rebook';

DROP INDEX IF EXISTS idx_recruit_applicants_dnr_email;
ALTER TABLE recruit_applicants DROP CONSTRAINT IF EXISTS recruit_applicants_dnr_explained;
ALTER TABLE recruit_applicants
  DROP COLUMN IF EXISTS do_not_rehire_at,
  DROP COLUMN IF EXISTS do_not_rehire_reason,
  DROP COLUMN IF EXISTS do_not_rehire;

-- Re-book rows are real bookings and are KEPT; only the link back to the
-- missed interview, and the final-chance marker, are removed.
DROP INDEX IF EXISTS idx_recruit_interviews_one_rebook;
ALTER TABLE recruit_interviews DROP CONSTRAINT IF EXISTS recruit_interviews_rebook_not_self;
ALTER TABLE recruit_interviews
  DROP COLUMN IF EXISTS rebook_of_interview_id,
  DROP COLUMN IF EXISTS is_final_chance;
