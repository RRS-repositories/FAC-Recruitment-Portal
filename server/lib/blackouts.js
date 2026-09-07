import { pool } from './db.js';

/**
 * Time the interviewer is not available.
 *
 * Deliberately shaped like a booking. `buildAvailability` already takes a list
 * of `{ startsAt, endsAt }` periods to avoid, so a blackout is not a new
 * concept in the availability engine — it is one more entry in a list that
 * already exists. When Google or Outlook free/busy arrives, those periods join
 * the same list and none of the slot arithmetic changes.
 */

/**
 * Periods to avoid, for one interviewer, in the shape the engine wants.
 *
 * Bounded to the window actually being offered rather than fetching every
 * blackout ever recorded — someone's holiday next spring is not relevant to a
 * fortnight of slots.
 */
export async function blackoutsFor(interviewerId, { from = new Date(), days = 30 } = {}) {
  const until = new Date(from.getTime() + days * 24 * 3_600_000);

  const { rows } = await pool.query(
    `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
       FROM recruit_blackouts
      WHERE interviewer_id = $1
        AND ends_at > $2
        AND starts_at < $3
      ORDER BY starts_at`,
    [interviewerId, from, until],
  );

  return rows;
}

/** Everything on record, for the settings screen. Past ones included. */
export async function listBlackouts(interviewerId) {
  const { rows } = await pool.query(
    `SELECT id, starts_at, ends_at, reason, created_by_email, created_at
       FROM recruit_blackouts
      WHERE interviewer_id = $1
      ORDER BY starts_at DESC
      LIMIT 200`,
    [interviewerId],
  );
  return rows;
}

/**
 * Adds one, and reports what it would have covered.
 *
 * Interviews already booked inside the period are NOT cancelled. Someone
 * marking themselves away next week has not asked to cancel three interviews,
 * and doing it silently would be the worst possible reading of the request.
 * The count comes back so the screen can say "this covers 2 booked
 * interviews" and let a person decide what to do about them.
 */
export async function addBlackout({ interviewerId, startsAt, endsAt, reason, createdByEmail }) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw Object.assign(new Error('Those dates are not valid.'), { status: 400 });
  }
  if (end <= start) {
    throw Object.assign(new Error('The end must be after the start.'), { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO recruit_blackouts (interviewer_id, starts_at, ends_at, reason, created_by_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, starts_at, ends_at, reason, created_by_email, created_at`,
      [interviewerId, start, end, reason?.trim() || null, createdByEmail ?? null],
    );

    const { rows: clashes } = await client.query(
      `SELECT i.id, i.starts_at, a.full_name, a.email
         FROM recruit_interviews i
         JOIN recruit_applicants a ON a.id = i.applicant_id
        WHERE i.interviewer_id = $1
          AND i.status = 'booked'
          AND i.starts_at < $3
          AND i.ends_at > $2
        ORDER BY i.starts_at`,
      [interviewerId, start, end],
    );

    await client.query('COMMIT');
    return { blackout: rows[0], clashes };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Removes one. Returns whether there was anything to remove. */
export async function removeBlackout(id, interviewerId) {
  const { rowCount } = await pool.query(
    'DELETE FROM recruit_blackouts WHERE id = $1 AND interviewer_id = $2',
    [id, interviewerId],
  );
  return rowCount > 0;
}
