import { pool } from './db.js';
import { generateBookingToken, tokenExpiry } from './bookingToken.js';
import { cancelPendingFor } from './outbox.js';
import { notifyNoShowFinal, notifyNoShowRebook } from './notify.js';
import { cancelMeetLink } from './meetLink.js';
import { renderQueued } from './templates.js';
import {
  DNR_REASON,
  PATHS,
  REBOOK_EXPIRY_DAYS,
  notAttendedDecision,
  notAttendedLabel,
} from './rebookPolicy.js';

/**
 * "Not attended" -- what one press does, in one transaction.
 *
 * The rules for WHO can be marked live in rebookPolicy.js; this file only
 * carries out what that decides. See NOSHOW-REBOOK-DEV-PLAN.md §4.2–§4.3.
 *
 * A MANAGER PRESSED THIS. Nothing automatic calls it (decided 15 Sep), so the
 * person recorded against every row it writes is the one who pressed.
 *
 * Returns a plain result the route turns into a response:
 *   { ok: true,  path: 'rebook', rebookInterviewId, expiresAt, bookingToken }
 *   { ok: true,  path: 'final' }
 *   { ok: false, status, code, message }
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Locked, so two presses for the same candidate cannot both decide at once.
 * The second waits here for the first to commit, then reads the world the
 * first left behind -- the new re-book row -- and is refused. The unique index
 * on rebook_of_interview_id backs this up in the database regardless.
 */
const READ_APPLICANT = `
  SELECT id, status, do_not_rehire, email, full_name, role
    FROM recruit_applicants
   WHERE id = $1
`;
const LOCK_APPLICANT = `${READ_APPLICANT} FOR UPDATE`;

// The most recent interview that HAS a time -- the same choice the existing
// attendance endpoint makes, so the two buttons always mean the same interview.
const READ_INTERVIEW = `
  SELECT id, status, starts_at, is_final_chance
    FROM recruit_interviews
   WHERE applicant_id = $1 AND starts_at IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1
`;
const LOCK_INTERVIEW = `${READ_INTERVIEW} FOR UPDATE`;

/*
 * Does the candidate already hold a newer link? A re-book row from this
 * feature, or an invitation the existing "reissue" button sent after the
 * missed interview. A cancelled one is not a link anybody can use.
 *
 * THE COMPARISON STAYS INSIDE THE DATABASE, and that is load-bearing.
 *
 * The first version passed the missed interview's `created_at` back in as a
 * parameter. Postgres keeps timestamps to the microsecond; a JavaScript Date
 * keeps milliseconds. The value came back rounded DOWN, so the interview's own
 * row compared as newer than itself -- and every re-book was refused as
 * "already has a newer link". Caught end to end against a real database; the
 * pure policy tests could not see it, because they are handed the answer.
 *
 * So both timestamps are read here, at full precision, and the row itself is
 * excluded by id rather than trusted to fall out of the comparison.
 */
const NEWER_OFFER = `
  SELECT EXISTS (
    SELECT 1
      FROM recruit_interviews later
      JOIN recruit_interviews missed ON missed.id = $1
     WHERE later.applicant_id = missed.applicant_id
       AND later.id <> missed.id
       AND later.created_at > missed.created_at
       AND later.status <> 'cancelled'
  ) AS offer_exists
`;

const MARK_NO_SHOW = `
  UPDATE recruit_interviews SET status = 'no_show', updated_at = now()
   WHERE id = $1 AND status = 'booked'
`;

const AUDIT = `
  INSERT INTO recruit_audit (applicant_id, actor_email, action, payload)
  VALUES ($1, $2, $3, $4)
`;

const refused = (status, code, message) => ({ ok: false, status, code, message });

export async function markNotAttended({ applicantId, actorEmail, db = pool }) {
  if (!UUID.test(String(applicantId ?? ''))) {
    return refused(404, 'not_found', 'That application could not be found.');
  }

  const client = await db.connect();
  let result;
  let interviewForCalendar = null;

  try {
    await client.query('BEGIN');

    const { rows: applicants } = await client.query(LOCK_APPLICANT, [applicantId]);
    const applicant = applicants[0];
    const { rows: interviews } = applicant
      ? await client.query(LOCK_INTERVIEW, [applicantId])
      : { rows: [] };
    const interview = interviews[0];

    let offerExists = false;
    if (interview) {
      const { rows } = await client.query(NEWER_OFFER, [interview.id]);
      offerExists = rows[0].offer_exists === true;
    }

    // Decided INSIDE the transaction, after the locks: a decision made on rows
    // read before them could be stale by the time it is acted on.
    const decision = notAttendedDecision({ applicant, interview, offerExists, now: new Date() });
    if (!decision.ok) {
      await client.query('ROLLBACK');
      return refused(decision.code === 'not_found' ? 404 : 409, decision.code, decision.message);
    }

    // Recorded only if it actually changed: pressed on an interview already
    // marked no-show by the existing button, there is nothing new to say.
    const marked = await client.query(MARK_NO_SHOW, [interview.id]);
    if (marked.rowCount > 0) {
      await client.query(AUDIT, [
        applicant.id,
        actorEmail,
        'no_show',
        JSON.stringify({ markedBy: actorEmail, via: 'not_attended', interviewId: interview.id }),
      ]);
    }

    // The missed interview's remaining reminders and posts are called off --
    // BEFORE anything new is queued against it, or the new email would be the
    // first thing cancelled.
    await cancelPendingFor(client, interview.id, 'marked not attended');

    if (decision.path === PATHS.rebook) {
      result = await offerRebook(client, { applicant, interview, actorEmail });
    } else {
      result = await endAfterFinalChance(client, { applicant, interview, actorEmail });
    }

    await client.query('COMMIT');
    interviewForCalendar = interview.id;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    // The database's own double-press guarantee firing: another press got
    // there first between our check and our insert. Not a failure -- the
    // outcome the manager wanted already exists.
    if (error.code === '23505' && /one_rebook/.test(error.constraint ?? error.message)) {
      return refused(409, 'offer_exists', 'That candidate already has a newer booking link, so a second one would not be sent.');
    }
    throw error;
  } finally {
    client.release();
  }

  /*
   * After the commit, never inside it: Google being slow or down must not hold
   * a transaction open, or undo a re-book that has already been offered. The
   * missed interview's calendar event goes; Google's own emails are switched
   * off in cancelMeetLink, so nobody is notified. A failure is logged, not
   * returned -- the manager's action has succeeded either way.
   */
  if (interviewForCalendar) {
    await cancelMeetLink(interviewForCalendar).catch((error) => {
      console.error(`[fac-recruit] not attended: could not remove the calendar event: ${error.message}`);
    });
  }

  return result;
}

/*
 * What pressing would do, WITHOUT doing it -- for the confirm dialog.
 *
 * The same reads, the same rules (notAttendedDecision) and the same email the
 * press would queue, rendered through renderQueued exactly as the outbox
 * renders it at send time. So the dialog cannot show a manager one email and
 * send the candidate another, or offer a button the press would then refuse.
 *
 * Nothing is locked or written. The press re-decides inside its own
 * transaction regardless, so a preview that goes stale while the dialog is
 * open is refused there rather than acted on.
 *
 * The booking link in the preview is a placeholder: the real one is created
 * only when the manager confirms, and is shown to them then.
 */
export const PREVIEW_TOKEN = 'your-new-link-is-created-when-you-confirm';

export async function previewNotAttended({ applicantId, db = pool, now = new Date() }) {
  if (!UUID.test(String(applicantId ?? ''))) {
    return refused(404, 'not_found', 'That application could not be found.');
  }

  const { rows: applicants } = await db.query(READ_APPLICANT, [applicantId]);
  const applicant = applicants[0];
  const { rows: interviews } = applicant ? await db.query(READ_INTERVIEW, [applicantId]) : { rows: [] };
  const interview = interviews[0];

  let offerExists = false;
  if (interview) {
    const { rows } = await db.query(NEWER_OFFER, [interview.id]);
    offerExists = rows[0].offer_exists === true;
  }

  const decision = notAttendedDecision({ applicant, interview, offerExists, now });
  if (!decision.ok) {
    if (decision.code === 'not_found') return refused(404, decision.code, decision.message);
    return { ok: true, eligible: false, code: decision.code, message: decision.message };
  }

  const template = decision.path === PATHS.rebook ? 'recruit.noshow.rebook' : 'recruit.noshow.final';
  const email = await renderQueued(
    {
      template,
      applicant_id: applicant.id,
      interview_id: interview.id,
      vars: decision.path === PATHS.rebook ? { token: PREVIEW_TOKEN } : {},
    },
    db,
  );

  return {
    ok: true,
    eligible: true,
    path: decision.path,
    label: notAttendedLabel(decision),
    applicant: { id: applicant.id, fullName: applicant.full_name, email: applicant.email },
    interview: { id: interview.id, startsAt: interview.starts_at, status: interview.status },
    expiryDays: REBOOK_EXPIRY_DAYS,
    email: { template, subject: email.subject, html: email.html ?? null, text: email.text },
  };
}

/** First missed interview: one final re-book. */
async function offerRebook(client, { applicant, interview, actorEmail }) {
  const { rows: interviewers } = await client.query(
    'SELECT id FROM recruit_interviewers WHERE active ORDER BY id LIMIT 1',
  );
  if (!interviewers[0]) throw new Error('no active interviewer configured');

  const { token, hash } = generateBookingToken();
  const expiresAt = tokenExpiry(REBOOK_EXPIRY_DAYS);

  const { rows } = await client.query(
    `INSERT INTO recruit_interviews
       (applicant_id, interviewer_id, booking_token_hash, token_expires_at, status,
        is_final_chance, rebook_of_interview_id)
     VALUES ($1, $2, $3, $4, 'invited', true, $5)
     RETURNING id, token_expires_at`,
    [applicant.id, interviewers[0].id, hash, expiresAt, interview.id],
  );
  const rebook = rows[0];

  await notifyNoShowRebook(client, {
    applicant,
    missedInterviewId: interview.id,
    bookingToken: token,
  });

  await client.query(AUDIT, [
    applicant.id,
    actorEmail,
    'rebook_offered',
    JSON.stringify({
      offeredBy: actorEmail,
      missedInterviewId: interview.id,
      rebookInterviewId: rebook.id,
      expiresAt: rebook.token_expires_at,
    }),
  ]);

  return {
    ok: true,
    path: PATHS.rebook,
    rebookInterviewId: rebook.id,
    expiresAt: rebook.token_expires_at,
    // Returned as the existing reissue endpoint returns it, so the dashboard
    // can offer the link by hand when email is switched off.
    bookingToken: token,
  };
}

/*
 * The final chance was missed: the application ends and they are barred.
 *
 * `decided_by_email` is the MANAGER who pressed, not a system actor. They
 * confirmed a dialog saying exactly this would happen, so the decision is
 * theirs, and the audit trail should say whose. (The system actor in
 * rebookPolicy.js is for the one automatic path left: an unused re-book link
 * expiring, which no person decides.)
 */
async function endAfterFinalChance(client, { applicant, interview, actorEmail }) {
  await client.query(
    `UPDATE recruit_applicants
        SET status = 'declined', decided_by_email = $2, decided_at = now(),
            do_not_rehire = true, do_not_rehire_reason = $3, do_not_rehire_at = now()
      WHERE id = $1`,
    [applicant.id, actorEmail, DNR_REASON.twoNoShows],
  );

  await notifyNoShowFinal(client, { applicant, interviewId: interview.id });

  await client.query(AUDIT, [
    applicant.id,
    actorEmail,
    'no_show_final',
    JSON.stringify({ markedBy: actorEmail, interviewId: interview.id }),
  ]);
  await client.query(AUDIT, [
    applicant.id,
    actorEmail,
    'do_not_rehire',
    JSON.stringify({ addedBy: actorEmail, reason: DNR_REASON.twoNoShows }),
  ]);

  return { ok: true, path: PATHS.final };
}
