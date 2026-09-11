-- Where a queued message goes: email, or the Mattermost interview channel.
--
-- The queue already solves everything a chat post needs and has been solving
-- it for every email since recruit_004: exactly-once through the UNIQUE
-- dedupe_key, retry with backoff, cancellation when an interview moves, and a
-- visible unsent row when something is stuck. A separate mechanism for chat
-- would have to reinvent all four, so a chat post is simply another row.
--
-- One column, and no existing constraint is touched. Every row already in the
-- table becomes 'email' by the default and behaves exactly as it did.
--
-- `to_email` deliberately stays NOT NULL, and a chat row carries the
-- INTERVIEWER'S address in it. Relaxing that constraint so chat rows could
-- leave it empty would weaken a guard protecting several hundred email rows to
-- buy nothing: the interviewer is who the post is for, they are in the
-- channel, and keeping it populated means the "unsent messages" view on an
-- applicant still says who each row concerns.

ALTER TABLE recruit_outbox
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';

ALTER TABLE recruit_outbox
  DROP CONSTRAINT IF EXISTS recruit_outbox_channel_known;

ALTER TABLE recruit_outbox
  ADD CONSTRAINT recruit_outbox_channel_known
  CHECK (channel IN ('email', 'mattermost'));

-- The drain orders by send_after and filters on sent_at/cancelled_at; adding
-- the channel to that picture costs nothing and keeps "what chat posts are
-- pending" answerable without a sequential scan once the table grows.
CREATE INDEX IF NOT EXISTS idx_recruit_outbox_channel_pending
  ON recruit_outbox (channel, send_after)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;
