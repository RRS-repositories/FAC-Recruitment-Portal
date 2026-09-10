-- recruit_009 — the LLM review of an application.
--
-- Two questions asked of a model, per applicant, once:
--
--   how well does this CV and these answers fit the role   -> ai_score
--   does the writing read as AI-assisted                   -> one more reason
--
-- WHY A TABLE AND NOT COLUMNS. `recruit_applicants` already carries the two
-- answers this produces (ai_score, and the ai_use_* set). What it has nowhere
-- to put is everything needed to *defend* them later: which model answered,
-- which prompt it was asked, what it actually said, and when. A score that
-- influences whether someone is hired has to be explicable a year afterwards,
-- when the model has been retired and the prompt rewritten twice.
--
-- It is also the queue. A model call takes seconds and can fail, so it cannot
-- sit on the submission path — an applicant must never be turned away because
-- an external service was slow. Rows are claimed the same way the outbox
-- claims email, with FOR UPDATE SKIP LOCKED.
--
-- NUMBERED 009, NOT 008, ON PURPOSE. 008 is taken in the CRM's copy of these
-- migrations (the append-only audit trigger, which standalone does not need).
-- Both sets are applied to the same database in production, so the numbers are
-- kept aligned rather than allowed to mean different things in each.

CREATE TABLE IF NOT EXISTS recruit_llm_reviews (
  applicant_id    uuid PRIMARY KEY REFERENCES recruit_applicants(id) ON DELETE CASCADE,

  -- queued  — waiting for the worker
  -- done    — the model answered and the answer is stored
  -- failed  — gave up after the attempt limit; last_error says why
  -- skipped — deliberately not sent (no CV text, or review switched off)
  status          text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'done', 'failed', 'skipped')),

  -- Provenance. Without these the score is a number with no argument behind it.
  model           text,
  prompt_version  smallint,

  -- Fitment. Copied to recruit_applicants.ai_score on success, which the
  -- generated final_score then prefers over rule_score automatically.
  fitment_score   smallint CHECK (fitment_score IS NULL OR fitment_score BETWEEN 0 AND 100),
  fitment_summary text,
  fitment_reasons jsonb,

  -- The model's view on AI use. Deliberately NOT a score: spec §13.3 warns
  -- that text-only detection false-positives on fluent non-native writers,
  -- which is most of this pool, so this is an opinion that adds one weighted
  -- reason to the behavioural verdict rather than becoming the verdict.
  ai_opinion      text CHECK (ai_opinion IS NULL OR ai_opinion IN ('likely', 'unclear', 'unlikely')),
  ai_rationale    text,

  -- How much of the CV we managed to read. 0 means extraction failed — worth
  -- knowing, because a fitment score formed without the CV is a weaker claim.
  cv_chars        integer,

  -- Exactly what came back, so a disputed score can be re-read rather than
  -- re-argued from memory.
  raw             jsonb,

  attempts        smallint NOT NULL DEFAULT 0,
  last_error      text,
  run_after       timestamptz NOT NULL DEFAULT now(),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

-- The worker's only query: what is due. Partial, because once a review is done
-- it is never looked at this way again.
CREATE INDEX IF NOT EXISTS idx_recruit_llm_reviews_due
  ON recruit_llm_reviews (run_after)
  WHERE status = 'queued';

-- Off, like every other flag (spec §2). Nothing is sent to an external model
-- until somebody deliberately turns this on — which matters more here than
-- elsewhere, because turning it on starts sending candidates' personal data to
-- a third party.
INSERT INTO recruit_settings (key, value, updated_at)
VALUES ('flags.recruitment_ai_review', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
