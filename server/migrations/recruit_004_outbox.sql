-- recruit_004_outbox
-- The email queue.
--
-- Every email the portal sends becomes a row here first. Nothing is sent from
-- inside a request: the handler writes the row and returns, and a worker picks
-- it up. That keeps a candidate's submission independent of whether the mail
-- server is reachable — an SMTP outage delays a notification instead of
-- failing an application the database has already accepted.
--
-- The same table carries scheduled mail. A reminder due in 24 hours is just a
-- row with `send_after` in the future, so retry backoff and delayed sending
-- are one mechanism rather than two.

BEGIN;

CREATE TABLE recruit_outbox (
  id            bigserial PRIMARY KEY,

  -- Which template to render, e.g. 'recruit.india.accept'. Not an enum: adding
  -- an email should not need a migration.
  template      text NOT NULL CHECK (length(template) BETWEEN 1 AND 60),

  to_email      citext NOT NULL CHECK (length(to_email) BETWEEN 3 AND 254),
  to_name       text,

  -- What the email is about. Both are nullable because not every email has an
  -- interview behind it, and ON DELETE CASCADE means removing an applicant
  -- takes their unsent mail with them.
  applicant_id  uuid REFERENCES recruit_applicants(id) ON DELETE CASCADE,
  interview_id  uuid REFERENCES recruit_interviews(id) ON DELETE CASCADE,

  -- Only values that CANNOT be re-derived when the email is rendered. Almost
  -- everything is looked up live at send time, so a candidate who reschedules
  -- never receives a reminder carrying their old time.
  --
  -- The exception is the booking token: it is returned once and stored only as
  -- a hash, so it cannot be recovered later and has to be captured here. That
  -- makes this column briefly hold a live credential — the application clears
  -- it as soon as the email is sent.
  vars          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Now for an immediate email; a future time for a reminder or a retry.
  send_after    timestamptz NOT NULL DEFAULT now(),

  attempts      smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error    text,

  sent_at       timestamptz,
  cancelled_at  timestamptz,

  /*
   * The idempotency guarantee, and deliberately a database constraint rather
   * than a check in application code.
   *
   * A key like 'reminder24:<interview>:<starts_at>' cannot be inserted twice,
   * so no retry, restart or concurrent worker can send the same email again —
   * regardless of what the application logic does. Including the start time
   * means a rescheduled interview produces a NEW key naturally, and the old
   * row is cancelled rather than having to be rewritten.
   */
  dedupe_key    text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 200),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- An email cannot both have gone and been called off.
  CONSTRAINT not_both_sent_and_cancelled CHECK (sent_at IS NULL OR cancelled_at IS NULL)
);

-- The worker's claim query: only rows still waiting, oldest due first. Partial,
-- so the index stays small however much sent mail accumulates behind it.
CREATE INDEX idx_recruit_outbox_due
  ON recruit_outbox (send_after)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

-- The dashboard asks "what has this candidate been sent?"
CREATE INDEX idx_recruit_outbox_applicant ON recruit_outbox (applicant_id, created_at DESC);

-- Cancelling a rescheduled interview's pending reminders.
CREATE INDEX idx_recruit_outbox_interview ON recruit_outbox (interview_id)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

/*
 * Privileges.
 *
 * recruit_002 set ALTER DEFAULT PRIVILEGES to SELECT, INSERT, UPDATE on new
 * tables, which is exactly right here and is spelled out rather than relied
 * upon. No DELETE: a sent email is a record that it was sent, and cancelling
 * sets a timestamp instead of removing the row — "why did they never get the
 * reminder" has to stay answerable.
 */
GRANT SELECT, INSERT, UPDATE ON recruit_outbox TO :"app_role";
GRANT USAGE, SELECT ON SEQUENCE recruit_outbox_id_seq TO :"app_role";

COMMIT;
