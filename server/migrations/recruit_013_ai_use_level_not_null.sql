-- The AI-check column must always have something to show.
--
-- `ai_use_level` was nullable with no default, and stayed populated only
-- because the single INSERT that creates an applicant happens to compute it.
-- That is a convention, not a guarantee: a future insert that forgot would
-- leave a row the dashboard could not label, in the one column whose job is to
-- warn somebody.
--
-- Safe to apply as written: every row is already populated (292 of 292 when
-- this was written, zero nulls), so the constraint validates without touching
-- data. The UPDATE below is belt and braces for any row added between the
-- check and the ALTER, and is a no-op otherwise.
--
-- 'clean' is the right backstop for a row that somehow has no verdict, because
-- it is what the behavioural pass produces when it notices nothing -- and the
-- client renders an unrecognised or missing level as "Not checked" regardless,
-- so nothing silently reads as reassuring.

UPDATE recruit_applicants SET ai_use_level = 'clean' WHERE ai_use_level IS NULL;
UPDATE recruit_applicants SET ai_use_score = 0 WHERE ai_use_score IS NULL;
UPDATE recruit_applicants SET ai_use_reasons = '[]'::jsonb WHERE ai_use_reasons IS NULL;

ALTER TABLE recruit_applicants
  ALTER COLUMN ai_use_level SET DEFAULT 'clean',
  ALTER COLUMN ai_use_level SET NOT NULL;

ALTER TABLE recruit_applicants
  ALTER COLUMN ai_use_score SET DEFAULT 0,
  ALTER COLUMN ai_use_score SET NOT NULL;

ALTER TABLE recruit_applicants
  ALTER COLUMN ai_use_reasons SET DEFAULT '[]'::jsonb,
  ALTER COLUMN ai_use_reasons SET NOT NULL;

-- A level the dashboard has no label for is a bug that should be caught where
-- it is written, not discovered as a blank cell weeks later.
ALTER TABLE recruit_applicants
  DROP CONSTRAINT IF EXISTS ai_use_level_known;

ALTER TABLE recruit_applicants
  ADD CONSTRAINT ai_use_level_known
  CHECK (ai_use_level IN ('clean', 'possible', 'ai_used'));
