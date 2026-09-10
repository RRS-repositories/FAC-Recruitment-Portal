-- recruit_010 — what the calendar knows about an interview.
--
-- `meet_link` already exists, and has since recruit_001: the column was always
-- meant to be filled by something, and until now that something was a person
-- pasting into the dashboard. These two columns are what it takes to fill it
-- automatically and keep it true afterwards.
--
-- calendar_event_id — because a booking that is moved or cancelled has to move
--   or cancel the event too. Without the id the only options are leaving a
--   stale invitation showing a time the interview is no longer at, or making
--   a fresh link and a fresh confusion.
--
-- meet_link_error — because a missing link must not read as "no link needed".
--   The dashboard shows this, so the one interview that failed is visible
--   rather than silently ordinary.
--
-- Numbered 010 in both repositories, as 009 was, so the two sets stay aligned
-- against the one database they are both applied to.

ALTER TABLE recruit_interviews
  ADD COLUMN IF NOT EXISTS calendar_event_id text,
  ADD COLUMN IF NOT EXISTS meet_link_error   text;

-- The retry job's only question: which booked interviews still have no link?
-- Partial, because an interview with a link is never looked at this way again,
-- and past interviews cannot be helped.
CREATE INDEX IF NOT EXISTS idx_recruit_interviews_needs_link
  ON recruit_interviews (starts_at)
  WHERE meet_link IS NULL AND status = 'booked';

-- Off, like every other flag (spec §2). With it off the manual paste is still
-- there and nothing reaches Google.
INSERT INTO recruit_settings (key, value, updated_at)
VALUES ('flags.recruitment_auto_meet', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
