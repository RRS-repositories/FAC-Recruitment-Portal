-- Undo recruit_010.
--
-- `meet_link` is deliberately left alone: it predates this migration, and a
-- link already sent to a candidate is still the link they will turn up to.
-- Only what this migration added goes.
DROP INDEX IF EXISTS idx_recruit_interviews_needs_link;

ALTER TABLE recruit_interviews
  DROP COLUMN IF EXISTS meet_link_error,
  DROP COLUMN IF EXISTS calendar_event_id;

DELETE FROM recruit_settings WHERE key = 'flags.recruitment_auto_meet';
