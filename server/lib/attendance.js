import { pool } from './db.js';
import { isEnabled } from './flags.js';

/**
 * Marking an interview nobody turned up to.
 *
 * Spec §6.4 wants this automatic: a job at `ends_at + 15 min` marks `no_show`
 * unless somebody has already said otherwise. The manual buttons stay — this
 * only catches the ones nobody got round to.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 * It sends no email. Marking a no-show and offering a rebook are separate
 * decisions, and only the first is safe to automate: this can be wrong — the
 * interviewer joined late, both were there on a different link, the candidate
 * rang instead — and an apology sent to somebody who did attend cannot be
 * taken back. The "we missed you" email is still sent the way it always was,
 * when a human reissues a link. This mirrors the manual endpoint exactly,
 * which also marks without emailing.
 *
 * It cancels nothing in the outbox. By `ends_at + 15m` both reminders have
 * long gone, so there is nothing pending to call off, and reaching into the
 * queue for no reason is how a sweep starts breaking things next to it.
 *
 * It touches only `booked`. Not `attended`, not `cancelled`, not a row whose
 * time has not passed. And because marking moves a row out of `booked`, the
 * same interview can never be marked twice.
 */

const GRACE_MINUTES = Number(process.env.NOSHOW_GRACE_MINUTES || 15);
const INTERVAL_MS = Number(process.env.NOSHOW_INTERVAL_MS || 300_000);
const BATCH = Number(process.env.NOSHOW_BATCH || 20);

/**
 * Interviews that have finished, plus the grace period, and were never marked.
 *
 * `FOR UPDATE SKIP LOCKED` for the same reason the outbox uses it: two workers,
 * or an overlapping tick, must not both mark the same row.
 */
const CLAIM = `
  SELECT i.id, i.applicant_id, i.starts_at, i.ends_at
    FROM recruit_interviews i
   WHERE i.status = 'booked'
     AND i.ends_at IS NOT NULL
     AND i.ends_at < now() - ($1 || ' minutes')::interval
   ORDER BY i.ends_at
   LIMIT $2
     FOR UPDATE SKIP LOCKED
`;

/**
 * One pass. Exported so it can be run once, deliberately, without the timer.
 *
 * @returns {Promise<number>} how many were marked
 */
export async function sweepNoShows(db = pool) {
  if (!(await isEnabled('recruitment_auto_noshow'))) return 0;

  const client = await db.connect();
  let marked = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(CLAIM, [String(GRACE_MINUTES), BATCH]);

    for (const row of rows) {
      // Guarded on status again inside the write. The claim holds a row lock,
      // but a manager marking "attended" from the dashboard commits on another
      // connection, and losing that race must not overwrite what a person said.
      const { rowCount } = await client.query(
        `UPDATE recruit_interviews
            SET status = 'no_show', updated_at = now()
          WHERE id = $1 AND status = 'booked'`,
        [row.id],
      );
      if (!rowCount) continue;

      // actor_email is left NULL on purpose: nobody decided this. Inventing a
      // sentinel address would put a person's name against a machine's guess
      // in a trail that exists to answer "who decided this".
      await client.query(
        `INSERT INTO recruit_audit (applicant_id, action, payload)
         VALUES ($1, 'no_show', $2::jsonb)`,
        [
          row.applicant_id,
          JSON.stringify({
            by: 'automatic',
            reason: `not marked within ${GRACE_MINUTES} minutes of the interview ending`,
            endedAt: row.ends_at,
          }),
        ],
      );
      marked += 1;
      console.log(`[fac-recruit] auto-marked interview ${row.id} as no_show`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[fac-recruit] no-show sweep failed:', error.message);
  } finally {
    client.release();
  }
  return marked;
}

export function startNoShowSweep() {
  const timer = setInterval(() => {
    sweepNoShows().catch((error) =>
      console.error('[fac-recruit] no-show tick failed:', error.message),
    );
  }, INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
