-- Undo recruit_009. The reviews go with it, which is the point: if the feature
-- is being removed, the model's opinions about real people should not linger.
--
-- recruit_applicants.ai_score is deliberately cleared as well. Leaving it would
-- keep final_score preferring a number whose reasoning no longer exists.
UPDATE recruit_applicants SET ai_score = NULL WHERE ai_score IS NOT NULL;

DROP INDEX IF EXISTS idx_recruit_llm_reviews_due;
DROP TABLE IF EXISTS recruit_llm_reviews;

DELETE FROM recruit_settings WHERE key = 'flags.recruitment_ai_review';
