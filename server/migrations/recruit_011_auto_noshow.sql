-- recruit_011 — the switch for automatic no-show marking (spec §6.4).
--
-- Off, like every flag. The manual buttons on the dashboard already work and
-- keep working; this only decides whether anything marks the ones nobody got
-- round to.
--
-- Worth switching on deliberately rather than by default, because being marked
-- a no-show is a thing said about a real person, and the sweep can be wrong:
-- the interviewer joined late, both were present on a different link, the
-- candidate rang instead. It sends no email precisely so that a wrong mark
-- stays correctable and invisible to the candidate.

INSERT INTO recruit_settings (key, value, updated_at)
VALUES ('flags.recruitment_auto_noshow', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- The sweep's only query: interviews still 'booked' whose time has passed.
-- Partial, because a marked interview is never looked at this way again.
CREATE INDEX IF NOT EXISTS idx_recruit_interviews_unmarked
  ON recruit_interviews (ends_at)
  WHERE status = 'booked';
