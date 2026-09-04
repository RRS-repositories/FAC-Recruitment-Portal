-- recruit_003_seed_down
-- Removes only the seeded defaults, leaving anything created since.
--
-- The interviewer is removed only when nothing references them. Deleting an
-- interviewer who has interviews would either fail on the foreign key (which
-- broke the rollback chain the first time this was run) or, worse, cascade and
-- take real interview history with it. Leaving the row is the safe outcome:
-- re-running the seed is idempotent, so a leftover interviewer costs nothing.

DELETE FROM recruit_settings WHERE key IN (
  'ai_use.thresholds', 'ai_use.weights', 'ai_use.limits', 'ai_use.phrases',
  'application.fast_submit_seconds'
);

DELETE FROM recruit_availability_rules
 WHERE interviewer_id IN (
   SELECT id FROM recruit_interviewers WHERE email = 'priyanshu@fastactionclaims.co.uk'
 );

DELETE FROM recruit_interviewers i
 WHERE i.email = 'priyanshu@fastactionclaims.co.uk'
   AND NOT EXISTS (SELECT 1 FROM recruit_interviews x WHERE x.interviewer_id = i.id)
   AND NOT EXISTS (SELECT 1 FROM recruit_availability_rules r WHERE r.interviewer_id = i.id);
