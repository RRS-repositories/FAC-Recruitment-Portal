-- recruit_005_blackouts (down)
--
-- Drops the blackouts and removes the feature flags.
--
-- Note what rolling this back means: with the flag rows gone, the application
-- reads "no setting" and falls back to its default. That default is OFF, so a
-- rollback closes the portal rather than opening it — which is the safe
-- direction, but it will look like an outage if it is not expected.
--
-- Any out-of-office periods are lost. Nothing else references them, so no
-- booking is affected; the slots simply become available again.

BEGIN;

DROP TABLE IF EXISTS recruit_blackouts;

DELETE FROM recruit_settings
 WHERE key IN (
   'flags.recruitment_portal',
   'flags.recruitment_booking',
   'flags.recruitment_alerts'
 );

COMMIT;
