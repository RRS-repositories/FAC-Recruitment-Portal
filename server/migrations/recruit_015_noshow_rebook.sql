-- recruit_015 — "Not attended" → one final re-book (NOSHOW-REBOOK-DEV-PLAN.md).
--
-- A missed interview is NEVER edited to make room for a re-book. The
-- booked_has_time constraint requires a no_show interview to keep its times,
-- and that is correct: "they missed Monday at 10:00" is a fact worth keeping.
-- A re-book is a NEW interview row, pointing back at the one that was missed.
-- The existing "reissue after a no-show" path already works this way; this
-- migration only adds what that path could not say.
--
-- Everything here is additive, with defaults, so every existing row reads
-- exactly as it did and nothing changes until the feature is switched on.

-- ── The re-book interview ───────────────────────────────────────────────────

ALTER TABLE recruit_interviews
  ADD COLUMN IF NOT EXISTS is_final_chance boolean NOT NULL DEFAULT false;

-- SET NULL rather than CASCADE: if the missed interview were ever removed, the
-- re-book is still a real booking somebody made, and must not vanish with it.
ALTER TABLE recruit_interviews
  ADD COLUMN IF NOT EXISTS rebook_of_interview_id uuid
    REFERENCES recruit_interviews(id) ON DELETE SET NULL;

-- A re-book cannot point at itself.
ALTER TABLE recruit_interviews
  DROP CONSTRAINT IF EXISTS recruit_interviews_rebook_not_self;
ALTER TABLE recruit_interviews
  ADD CONSTRAINT recruit_interviews_rebook_not_self
  CHECK (rebook_of_interview_id IS NULL OR rebook_of_interview_id <> id);

-- THE double-click guarantee. One missed interview can be offered ONE re-book,
-- however many times the button is pressed or the request retried: a second
-- insert for the same missed interview fails in the database, not merely in
-- application code that might one day be refactored around.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recruit_interviews_one_rebook
  ON recruit_interviews (rebook_of_interview_id)
  WHERE rebook_of_interview_id IS NOT NULL;

-- ── Do not rehire ───────────────────────────────────────────────────────────

ALTER TABLE recruit_applicants
  ADD COLUMN IF NOT EXISTS do_not_rehire boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_rehire_reason text,
  ADD COLUMN IF NOT EXISTS do_not_rehire_at timestamptz;

-- A bar with no reason or no date is a record nobody can explain later, and
-- the candidate is told in writing that this list exists. So the three travel
-- together, and a reason is capped rather than an essay.
ALTER TABLE recruit_applicants
  DROP CONSTRAINT IF EXISTS recruit_applicants_dnr_explained;
ALTER TABLE recruit_applicants
  ADD CONSTRAINT recruit_applicants_dnr_explained CHECK (
    (do_not_rehire = false AND do_not_rehire_reason IS NULL AND do_not_rehire_at IS NULL)
    OR (do_not_rehire = true
        AND do_not_rehire_at IS NOT NULL
        AND length(btrim(coalesce(do_not_rehire_reason, ''))) BETWEEN 1 AND 300)
  );

-- Checked on every application submitted, against every role, so it must not
-- scan the table. Partial: the list is expected to stay small.
CREATE INDEX IF NOT EXISTS idx_recruit_applicants_dnr_email
  ON recruit_applicants (email)
  WHERE do_not_rehire;

-- ── The switch ──────────────────────────────────────────────────────────────

-- Off, like every flag. With it off the button is hidden, the endpoint answers
-- 404, and the dashboard behaves exactly as it did before this migration.
INSERT INTO recruit_settings (key, value, updated_at)
VALUES ('flags.recruitment_noshow_rebook', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
