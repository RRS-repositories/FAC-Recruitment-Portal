import { pool } from './db.js';
import { sendMail, mailMode } from './mailer.js';
import { renderQueued } from './templates.js';
import { BATCH, MAX_ATTEMPTS, backoffSeconds } from './outboxPolicy.js';

/**
 * The email queue.
 *
 * Recovered from the Atlas enquiry backend (commit ff5b683) rather than
 * rewritten, per CLAUDE.md. The claiming pattern, the backoff curve and the
 * reasoning behind not using Redis are all from there; what is new is a real
 * queue table instead of the enquiry row doubling as one, because this portal
 * sends nine different emails rather than one.
 *
 * Two rules the rest of the code depends on:
 *
 *   1. Enqueue inside the caller's transaction. `enqueue` takes a client, not
 *      the pool, so the email and the thing that caused it commit together. A
 *      decision can never be recorded without its email queued, and an email
 *      can never go out for a decision that rolled back.
 *
 *   2. Nothing is ever deleted. Cancelling sets a timestamp, so "why did they
 *      never get their reminder" stays answerable.
 */

/**
 * Rows are claimed with FOR UPDATE SKIP LOCKED, so a second worker — or an
 * overlapping tick of this one — cannot pick up the same email twice.
 */
const CLAIM = `
  SELECT id, template, to_email, to_name, applicant_id, interview_id, vars, attempts
    FROM recruit_outbox
   WHERE sent_at IS NULL
     AND cancelled_at IS NULL
     AND attempts < $1
     AND send_after <= now()
   ORDER BY send_after
   LIMIT $2
     FOR UPDATE SKIP LOCKED
`;

/**
 * Adds an email to the queue.
 *
 * `dedupeKey` is the guarantee: it is UNIQUE in the database, so a retry, a
 * restart or two concurrent requests cannot queue the same email twice. The
 * conflict is ignored rather than raised — asking for an email that is already
 * queued is not an error, it is the outcome the caller wanted.
 *
 * @param client an open pg client inside the caller's transaction
 */
export async function enqueue(client, {
  template,
  toEmail,
  toName = null,
  applicantId = null,
  interviewId = null,
  vars = {},
  sendAfter = null,
  dedupeKey,
}) {
  if (!template || !toEmail || !dedupeKey) {
    throw new Error('enqueue needs a template, a recipient and a dedupe key');
  }

  const { rows } = await client.query(
    `INSERT INTO recruit_outbox
       (template, to_email, to_name, applicant_id, interview_id, vars, send_after, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [template, toEmail, toName, applicantId, interviewId, JSON.stringify(vars), sendAfter, dedupeKey],
  );

  return rows[0]?.id ?? null;
}

/**
 * Calls off anything still waiting for an interview.
 *
 * Used when a candidate reschedules or cancels: the reminders queued for the
 * old time must not go out. Already-sent mail is untouched — it happened.
 */
export async function cancelPendingFor(client, interviewId, reason = 'superseded') {
  const { rowCount } = await client.query(
    `UPDATE recruit_outbox
        SET cancelled_at = now(), last_error = $2, updated_at = now()
      WHERE interview_id = $1 AND sent_at IS NULL AND cancelled_at IS NULL`,
    [interviewId, reason],
  );
  return rowCount;
}

/** What has been sent to one applicant — the dashboard's delivery line. */
export async function historyFor(applicantId) {
  const { rows } = await pool.query(
    `SELECT id, template, to_email, send_after, attempts, last_error,
            sent_at, cancelled_at, created_at
       FROM recruit_outbox
      WHERE applicant_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [applicantId],
  );
  return rows;
}

/**
 * One pass over the queue.
 *
 * Each row is claimed, rendered and sent inside its own transaction, so one
 * bad template cannot stop the rest of the batch. Returns a small summary,
 * which is what the tests assert on.
 */
export async function drainOnce() {
  const summary = { claimed: 0, sent: 0, failed: 0, mode: mailMode() };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(CLAIM, [MAX_ATTEMPTS, BATCH]);
    summary.claimed = rows.length;

    for (const row of rows) {
      try {
        const message = await renderQueued(row, client);
        const result = await sendMail({
          to: row.to_email,
          toName: row.to_name,
          template: row.template,
          ...message,
        });

        // `vars` is emptied on success. For the acceptance email it holds the
        // raw booking token — the one value that cannot be re-derived — and it
        // has no business outliving the send.
        await client.query(
          `UPDATE recruit_outbox
              SET sent_at = now(), last_error = $2, vars = '{}'::jsonb, updated_at = now()
            WHERE id = $1`,
          [row.id, `${result.mode}: ${result.reference}`],
        );
        summary.sent += 1;
      } catch (failure) {
        const attempts = row.attempts + 1;
        await client.query(
          `UPDATE recruit_outbox
              SET attempts = $2,
                  last_error = $3,
                  send_after = now() + ($4 || ' seconds')::interval,
                  updated_at = now()
            WHERE id = $1`,
          [row.id, attempts, String(failure.message).slice(0, 500), backoffSeconds(attempts)],
        );
        summary.failed += 1;

        if (attempts >= MAX_ATTEMPTS) {
          // Out of retries. Loud, because from here nobody is coming.
          console.error(
            `[fac-recruit] giving up on email ${row.id} (${row.template} → ${row.to_email}): ${failure.message}`,
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[fac-recruit] outbox pass failed:', error.message);
  } finally {
    client.release();
  }

  return summary;
}

/**
 * Runs `drainOnce` on a timer.
 *
 * Thirty seconds is chosen by the tightest deadline the queue has: the
 * ten-minute reminder. Half a minute of slack on that is invisible; it would
 * matter for nothing else here.
 *
 * `unref` so the interval never keeps the process alive on its own — a stuck
 * timer holding a server open is worse than a missed tick.
 */
export function startOutboxWorker({ intervalMs = Number(process.env.OUTBOX_INTERVAL_MS || 30_000) } = {}) {
  let running = false;

  const tick = async () => {
    if (running) return; // a slow pass must not overlap the next one
    running = true;
    try {
      const summary = await drainOnce();
      if (summary.sent || summary.failed) {
        console.log(
          `[fac-recruit] outbox: ${summary.sent} sent, ${summary.failed} failed (${summary.mode})`,
        );
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();

  return () => clearInterval(timer);
}
