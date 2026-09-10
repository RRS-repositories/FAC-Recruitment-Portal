import { pool } from './db.js';
import {
  createInterviewEvent,
  moveInterviewEvent,
  cancelInterviewEvent,
  calendarMode,
  CalendarError,
} from './googleCalendar.js';
import { isEnabled } from './flags.js';

/**
 * Getting a Meet link onto an interview, and keeping it true.
 *
 * WHY NONE OF THIS RUNS INSIDE THE BOOKING TRANSACTION. Booking holds
 * `pg_advisory_xact_lock` on the interviewer while it re-checks availability
 * and writes. A Google call inside that lock would put every other candidate
 * trying to book that interviewer behind a network round trip to a third
 * party — and behind its timeouts and outages. So the booking commits first
 * and the link is attached afterwards.
 *
 * WHY THAT IS SAFE. Every email template re-reads the database when it sends,
 * not when it is queued — `renderQueued` merges `load()` over the frozen vars,
 * and `loadContext` selects `i.meet_link`. So a link attached a second, or an
 * hour, after the confirmation was queued still reaches every email that has
 * not gone yet, including both reminders. Nothing needs re-queueing.
 *
 * And when it never arrives at all, `joinLine` already says "We will email you
 * the video link before your interview" instead of promising one. A failure
 * costs a slightly worse email, never a broken one.
 */

const MAX_ATTEMPTS = Number(process.env.MEET_LINK_MAX_ATTEMPTS || 5);
const INTERVAL_MS = Number(process.env.MEET_LINK_INTERVAL_MS || 120_000);
const BATCH = Number(process.env.MEET_LINK_BATCH || 5);

/** Everything the event needs, in one read. */
const CONTEXT = `
  SELECT i.id, i.starts_at, i.ends_at, i.status, i.meet_link, i.calendar_event_id,
         a.full_name, a.email, a.role,
         iv.full_name AS interviewer_name, iv.email AS interviewer_email,
         iv.google_calendar_id
    FROM recruit_interviews i
    JOIN recruit_applicants a    ON a.id = i.applicant_id
    JOIN recruit_interviewers iv ON iv.id = i.interviewer_id
   WHERE i.id = $1
`;

const ROLE_TITLE = { india_intern: 'Paralegal Internship', sa_paralegal: 'Paralegal' };

/** True when a link should be created at all. Both switches, as ever. */
export async function autoMeetOn() {
  return calendarMode() === 'on' && (await isEnabled('recruitment_auto_meet'));
}

/**
 * Attaches a Meet link to one interview.
 *
 * Safe to call twice: an interview that already has a link is left alone, so
 * a retry racing the booking path cannot make a second conference.
 *
 * @returns {Promise<{ok: boolean, meetLink?: string, skipped?: string, error?: string}>}
 */
export async function attachMeetLink(interviewId, db = pool) {
  if (!(await autoMeetOn())) return { ok: false, skipped: 'auto meet is off' };

  const { rows } = await db.query(CONTEXT, [interviewId]);
  const row = rows[0];
  if (!row) return { ok: false, skipped: 'no such interview' };
  if (row.meet_link) return { ok: true, meetLink: row.meet_link, skipped: 'already has one' };
  if (row.status !== 'booked') return { ok: false, skipped: `status is ${row.status}` };
  if (!row.starts_at) return { ok: false, skipped: 'no time chosen yet' };

  try {
    const { meetLink, eventId } = await createInterviewEvent({
      calendarId: row.google_calendar_id || 'primary',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      candidateName: row.full_name,
      candidateEmail: row.email,
      interviewerName: row.interviewer_name,
      interviewerEmail: row.interviewer_email,
      roleTitle: ROLE_TITLE[row.role] ?? null,
    });

    // Guarded on meet_link IS NULL so two workers cannot overwrite each
    // other's link, which would leave one orphaned conference nobody joins.
    await db.query(
      `UPDATE recruit_interviews
          SET meet_link = $2, calendar_event_id = $3, meet_link_error = NULL, updated_at = now()
        WHERE id = $1 AND meet_link IS NULL`,
      [interviewId, meetLink, eventId],
    );
    return { ok: true, meetLink };
  } catch (error) {
    const permanent = error instanceof CalendarError && error.retryable === false;
    await db.query(
      `UPDATE recruit_interviews SET meet_link_error = $2, updated_at = now() WHERE id = $1`,
      [interviewId, String(error.message).slice(0, 500)],
    );
    console.error(`[fac-recruit] no Meet link for interview ${interviewId}: ${error.message}`);
    return { ok: false, error: error.message, permanent };
  }
}

/**
 * Moves the event when a candidate reschedules.
 *
 * An invitation showing a time the interview has moved away from is worse than
 * no invitation, because it is believed. The link itself is kept: the
 * candidate may already have it in a calendar of their own.
 */
export async function moveMeetLink(interviewId, db = pool) {
  if (!(await autoMeetOn())) return { ok: false, skipped: 'auto meet is off' };
  const { rows } = await db.query(CONTEXT, [interviewId]);
  const row = rows[0];
  if (!row?.calendar_event_id) {
    // Booked before this feature existed, or the create failed. Either way the
    // right answer is to make one now rather than move something that is not
    // there.
    return attachMeetLink(interviewId, db);
  }
  try {
    await moveInterviewEvent({
      calendarId: row.google_calendar_id || 'primary',
      eventId: row.calendar_event_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    });
    return { ok: true };
  } catch (error) {
    await db.query(
      `UPDATE recruit_interviews SET meet_link_error = $2, updated_at = now() WHERE id = $1`,
      [interviewId, String(error.message).slice(0, 500)],
    );
    console.error(`[fac-recruit] could not move event for ${interviewId}: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

/** Cancels the event, so nobody is left holding an invitation to nothing. */
export async function cancelMeetLink(interviewId, db = pool) {
  if (calendarMode() === 'off') return { ok: false, skipped: 'calendar is off' };
  const { rows } = await db.query(CONTEXT, [interviewId]);
  const row = rows[0];
  if (!row?.calendar_event_id) return { ok: true, skipped: 'no event to cancel' };
  try {
    await cancelInterviewEvent({
      calendarId: row.google_calendar_id || 'primary',
      eventId: row.calendar_event_id,
    });
    await db.query(
      `UPDATE recruit_interviews SET calendar_event_id = NULL, updated_at = now() WHERE id = $1`,
      [interviewId],
    );
    return { ok: true };
  } catch (error) {
    console.error(`[fac-recruit] could not cancel event for ${interviewId}: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

/**
 * The ones that got away.
 *
 * A link missing at T−24h is a link the candidate never gets, because that
 * reminder is the last email before the day. So this sweeps for booked
 * interviews still without one and tries again, oldest first — the soonest
 * interview is the most urgent.
 */
const NEEDS_LINK = `
  SELECT id FROM recruit_interviews
   WHERE meet_link IS NULL
     AND status = 'booked'
     AND starts_at > now()
   ORDER BY starts_at
   LIMIT $1
`;

export async function sweepMissingLinks(db = pool) {
  if (!(await autoMeetOn())) return 0;
  const { rows } = await db.query(NEEDS_LINK, [BATCH]);
  let filled = 0;
  for (const row of rows) {
    const result = await attachMeetLink(row.id, db);
    if (result.ok && !result.skipped) filled += 1;
    // A permanently broken credential will fail identically for every row, so
    // stop rather than spend the batch proving it five times.
    if (result.permanent) {
      console.error('[fac-recruit] Meet links are failing permanently — stopping this sweep');
      break;
    }
  }
  return filled;
}

export function startMeetLinkSweep() {
  if (calendarMode() === 'off') {
    console.warn('[fac-recruit] no Meet link will be created — RECRUIT_GOOGLE_* is not set');
    return () => {};
  }
  const timer = setInterval(() => {
    sweepMissingLinks().catch((error) =>
      console.error('[fac-recruit] Meet link sweep failed:', error.message),
    );
  }, INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
