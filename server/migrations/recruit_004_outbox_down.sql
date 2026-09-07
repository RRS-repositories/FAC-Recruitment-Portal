-- recruit_004_outbox (down)
--
-- Drops the email queue. Anything still waiting to be sent goes with it, which
-- is the honest consequence of removing the feature: there would be nothing
-- left to send it.
--
-- The record of what was already sent goes too. That is a real loss, so before
-- rolling this back in production, keep a copy:
--
--   \copy (SELECT * FROM recruit_outbox) TO 'outbox-backup.csv' CSV HEADER
--
-- The indexes belong to the table and are dropped with it.

BEGIN;

DROP TABLE IF EXISTS recruit_outbox;

COMMIT;
