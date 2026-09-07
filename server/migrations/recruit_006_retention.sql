-- recruit_006_retention
-- CV retention — spec §12.
--
-- "CVs are personal data of non-clients ... lifecycle rule to delete declined
-- applicants' CVs after 6 months (SRA/UK GDPR retention)."
--
-- Nothing has ever deleted anything. Every CV submitted is still on disk, and
-- that pile only grows: this is the rare obligation that gets worse purely by
-- the passage of time, with no action needed to breach it.
--
-- The spec assumed an S3 lifecycle rule. CVs are on the server's own disk
-- instead, by the client's decision, so the rule has to be ours.

BEGIN;

/*
 * When the file was deleted.
 *
 * The row stays. Deleting the CV is not deleting the application — the
 * decision, the score and the audit trail are the firm's record of a hiring
 * round, and erasing those would answer a data-protection duty by destroying
 * the evidence of how someone was treated.
 *
 * `cv_filename` also stays, so a dashboard can say "there was a CV, it is
 * gone, and here is when" rather than showing nothing and looking broken.
 */
ALTER TABLE recruit_applicants ADD COLUMN cv_deleted_at timestamptz;

-- The sweep asks: declined, decided long enough ago, still holding a file.
-- Partial, so it stays small as deleted rows accumulate behind it.
CREATE INDEX idx_recruit_applicants_cv_sweep
  ON recruit_applicants (status, decided_at)
  WHERE cv_object_key IS NOT NULL AND cv_deleted_at IS NULL;

/*
 * The retention period, in months.
 *
 * §12 says six and adds "Brad to confirm period", so it lives in settings
 * rather than in code — confirming it should not need a deploy.
 *
 * Only declined applicants are covered, which is exactly what the spec says
 * and deliberately no more. Pending and accepted applicants have no policy
 * yet, and inventing one for somebody else's personal data is not a decision
 * to make quietly in a migration. Setting it to 0 switches deletion off
 * entirely.
 */
INSERT INTO recruit_settings (key, value) VALUES
  ('retention.declined_cv_months', '6'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
