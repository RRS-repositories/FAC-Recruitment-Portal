-- Undo recruit_012.
--
-- Restoring the plain unique index will FAIL if any email now has two
-- non-declined rows for the same role — which is exactly what this migration
-- made possible. That is deliberate: silently deleting one of somebody's
-- applications to make an index fit would be worse than refusing.
DROP INDEX IF EXISTS idx_recruit_applicants_email_history;
DROP INDEX IF EXISTS idx_recruit_applicants_email_role_live;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recruit_applicants_email_role
  ON recruit_applicants (email, role);

ALTER TABLE recruit_applicants
  DROP COLUMN IF EXISTS decline_reason_note,
  DROP COLUMN IF EXISTS decline_reason;
