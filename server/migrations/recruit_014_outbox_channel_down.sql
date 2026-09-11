-- Undo recruit_014.
--
-- Any queued chat post is cancelled rather than dropped, because nothing in
-- this table is ever deleted -- "why was that never posted" has to stay
-- answerable. Rows already sent keep their history; only the column that says
-- where they went goes away, so a sent chat post becomes indistinguishable
-- from a sent email. That is the cost of rolling this back and is the reason
-- to prefer leaving the column in place.

UPDATE recruit_outbox
   SET cancelled_at = now(),
       last_error = 'chat delivery was rolled back',
       updated_at = now()
 WHERE channel = 'mattermost'
   AND sent_at IS NULL
   AND cancelled_at IS NULL;

DROP INDEX IF EXISTS idx_recruit_outbox_channel_pending;

ALTER TABLE recruit_outbox
  DROP CONSTRAINT IF EXISTS recruit_outbox_channel_known;

ALTER TABLE recruit_outbox
  DROP COLUMN IF EXISTS channel;
