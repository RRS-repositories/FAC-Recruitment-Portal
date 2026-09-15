import { pool } from './db.js';
import { isEnabled } from './flags.js';
import { cancelPendingFor } from './outbox.js';
import { DNR_REASON, SYSTEM_NOSHOW_ACTOR } from './rebookPolicy.js';

/**
 * An unused final re-book link, after its 7 days.
 *
 * The re-book email tells the candidate, in writing: "if you do not re-book
 * within 7 days, your application will be closed permanently" and they will
 * not be considered again. Decided 15 Sep (plan §6.2, §8a point 3): the system
 * does what the email says. This is the ONE automatic consequence in the
 * feature -- a manager decided the missed interview; nobody decides that a
 * link went unused.
 *
 * WHAT IT DOES, per expired link, in one transaction:
 *   - the unused final-chance interview  -> cancelled (it can never be booked)
 *   - the application                    -> declined, by `system:no-show`
 *   - do-not-rehire                      -> set, "Did not re-book after a no-show"
 *   - anything still queued for it       -> called off
 *   - audit                              -> rebook_expired, do_not_rehire
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 * It sends no email. The candidate was already told exactly this would happen,
 * and no wording for a closing email after an unused link has been approved.
 *
 * It never touches a final chance that was BOOKED -- booking it is the whole
 * point -- nor one whose application is no longer accepted (a manager already
 * decided), nor one a newer, live interview has superseded.
 *
 * Behind `recruitment_noshow_rebook`: switched off, it does nothing at all.
 */

const INTERVAL_MS = Number(process.env.REBOOK_EXPIRY_INTERVAL_MS || 600_000);
const BATCH = Number(process.env.REBOOK_EXPIRY_BATCH || 20);

/*
 * `FOR UPDATE OF i, a SKIP LOCKED`: two workers, or a tick overlapping the
 * last, must not both close the same application -- and a row a manager or a
 * booking is holding right now is left for the next tick rather than waited on.
 *
 * is_final_chance through to_jsonb, like every other new read, so this query
 * cannot fail on a database that does not have recruit_015 yet.
 */
const CLAIM = `
  SELECT i.id, i.applicant_id, i.token_expires_at
    FROM recruit_interviews i
    JOIN recruit_applicants a ON a.id = i.applicant_id
   WHERE i.status = 'invited'
     AND COALESCE((to_jsonb(i) ->> 'is_final_chance')::boolean, false)
     AND i.token_expires_at < now()
     AND a.status = 'accepted'
     AND NOT EXISTS (
       SELECT 1 FROM recruit_interviews later
        WHERE later.applicant_id = i.applicant_id
          AND later.id <> i.id
          AND later.created_at > i.created_at
          AND later.status <> 'cancelled'
     )
   ORDER BY i.token_expires_at
   LIMIT $1
     FOR UPDATE OF i, a SKIP LOCKED
`;

const AUDIT = `
  INSERT INTO recruit_audit (applicant_id, action, payload) VALUES ($1, $2, $3::jsonb)
`;

/**
 * One pass. Exported so it can be run once, deliberately, without the timer.
 *
 * @returns {Promise<number>} how many applications were closed
 */
export async function sweepExpiredRebooks(db = pool) {
  if (!(await isEnabled('recruitment_noshow_rebook'))) return 0;

  const client = await db.connect();
  let closed = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(CLAIM, [BATCH]);

    for (const row of rows) {
      // Guarded on status again inside each write: the claim holds the locks,
      // but losing a race to a person must never overwrite what they did.
      const link = await client.query(
        `UPDATE recruit_interviews SET status = 'cancelled', updated_at = now()
          WHERE id = $1 AND status = 'invited'`,
        [row.id],
      );
      if (!link.rowCount) continue;

      const decision = await client.query(
        `UPDATE recruit_applicants
            SET status = 'declined', decided_by_email = $2, decided_at = now(),
                do_not_rehire = true, do_not_rehire_reason = $3, do_not_rehire_at = now()
          WHERE id = $1 AND status = 'accepted'`,
        [row.applicant_id, SYSTEM_NOSHOW_ACTOR, DNR_REASON.notRebooked],
      );
      if (!decision.rowCount) {
        // Cannot happen under the claim's lock, but if it ever did, the link is
        // still dead and nobody is barred on a decision that did not apply.
        continue;
      }

      await cancelPendingFor(client, row.id, 're-book link expired');

      // actor_email left NULL, as the no-show sweep does: nobody decided this.
      await client.query(AUDIT, [
        row.applicant_id,
        'rebook_expired',
        JSON.stringify({ by: 'automatic', interviewId: row.id, expiredAt: row.token_expires_at }),
      ]);
      await client.query(AUDIT, [
        row.applicant_id,
        'do_not_rehire',
        JSON.stringify({ by: 'automatic', reason: DNR_REASON.notRebooked }),
      ]);

      closed += 1;
      console.log(`[fac-recruit] re-book link expired unused: application ${row.applicant_id} closed`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[fac-recruit] re-book expiry sweep failed:', error.message);
  } finally {
    client.release();
  }
  return closed;
}

export function startRebookExpirySweep() {
  const timer = setInterval(() => {
    sweepExpiredRebooks().catch((error) =>
      console.error('[fac-recruit] re-book expiry tick failed:', error.message),
    );
  }, INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
