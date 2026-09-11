-- recruit_012 — why an application was declined, and letting a declined
-- candidate apply again.
--
-- Two changes that belong together: a reason is only worth recording if the
-- person can act on it, and acting on it means being allowed to reapply.

ALTER TABLE recruit_applicants
  -- The code from shared/declineReasons.js. Nullable, and null is the normal
  -- case: a manager who has not chosen a reason has not given one, and nothing
  -- should be invented on their behalf.
  ADD COLUMN IF NOT EXISTS decline_reason      text,
  -- Only used when the code is 'other'. Kept separate from the code so a
  -- free-text note can never be mistaken for a category in a later count.
  ADD COLUMN IF NOT EXISTS decline_reason_note text;

-- Deliberately no CHECK constraint on the code. The list of reasons is
-- expected to change as the firm learns what it actually declines people for,
-- and a CHECK would turn every edit to a plain JavaScript array into a
-- migration. The API validates against the shared list on the way in, which is
-- where a bad value can still be refused with a sentence a human can read.

-- ── Letting a declined candidate apply again ────────────────────────────────
--
-- recruit_001 put a plain unique index on (email, role): one application per
-- role per email, for ever. That is right while an application is live — two
-- open applications from the same person for the same job is a mess — and
-- wrong once it has been declined, because a candidate told "not this time"
-- should be able to try again next time.
--
-- So the index becomes partial: it constrains only rows that are still in
-- play. A declined row stops reserving the email, while pending and accepted
-- still do.
--
-- The declined application itself is kept, not replaced. "They applied twice
-- and we said no the first time" is worth being able to see, and the audit
-- trail refers to that row by id.
DROP INDEX IF EXISTS idx_recruit_applicants_email_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recruit_applicants_email_role_live
  ON recruit_applicants (email, role)
  WHERE status <> 'declined';

-- Finding a person's earlier attempts, which the dashboard will want to show
-- next to a reapplication so nobody is assessed without that context.
CREATE INDEX IF NOT EXISTS idx_recruit_applicants_email_history
  ON recruit_applicants (email, created_at DESC);
