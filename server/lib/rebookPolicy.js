/**
 * Who can be marked "Not attended", and what that press does.
 *
 * Pure: no database, no clock of its own, no Express. The endpoint loads the
 * rows and asks this; the tests ask it directly. It is the one place the rules
 * live, so the dashboard button, the calendar button and the endpoint cannot
 * disagree about who is eligible. See NOSHOW-REBOOK-DEV-PLAN.md §4.2–§4.3.
 *
 * A MANAGER MARKS EVERY NO-SHOW (decided 15 Sep). Nothing in the feature marks
 * one automatically, so everything this answers is in response to a person
 * pressing a button about an interview they know did not happen.
 */

/** How long a re-book link lasts. The email says 7 days, so this must too. */
export const REBOOK_EXPIRY_DAYS = 7;

/**
 * Who recorded a decision nobody clicked "decline" for.
 *
 * `decided_by_email` must be set whenever a decision is recorded
 * (decided_fields_together), and inventing a person there would put words in
 * somebody's mouth in the audit trail. A named system actor says plainly that
 * the decline followed from a rule, and which rule.
 */
export const SYSTEM_NOSHOW_ACTOR = 'system:no-show';

export const DNR_REASON = Object.freeze({
  twoNoShows: 'Two interview no-shows',
  notRebooked: 'Did not re-book after a no-show',
});

/**
 * The outcomes a press can have.
 *
 *   rebook  -- first missed interview: mark it no-show, offer one final re-book
 *   final   -- the missed interview WAS the final chance: decline and bar
 */
export const PATHS = Object.freeze({ rebook: 'rebook', final: 'final' });

/** Written for the manager who pressed the button, not for a log. */
const REFUSAL = Object.freeze({
  not_found: 'That application could not be found.',
  do_not_rehire: 'That candidate is already on the do-not-rehire list.',
  not_accepted: 'Only an accepted candidate can be marked as not attended.',
  no_interview: 'That candidate has not booked an interview.',
  attended:
    'That interview is recorded as attended. If that is wrong, correct it first, then mark them as not attended.',
  cancelled: 'That interview was cancelled, so there is nothing to mark.',
  wrong_status: 'That interview is not in a state that can be marked as not attended.',
  not_started: "That interview hasn't started yet.",
  offer_exists: 'That candidate already has a newer booking link, so a second one would not be sent.',
});

const refuse = (code) => ({ ok: false, code, message: REFUSAL[code] });

/**
 * Decides what pressing "Not attended" does.
 *
 * @param applicant  { status, do_not_rehire }
 * @param interview  their most recent interview THAT HAS A TIME
 *                   { status, starts_at, is_final_chance }
 * @param offerExists  a newer interview row already exists for this applicant:
 *                   a re-book from this feature, OR a link issued afterwards by
 *                   the existing "reissue" button. Either way they already hold
 *                   a working link, and a second would leave two live links
 *                   saying different things.
 * @param now        a Date, passed in so the rule is testable at any moment
 *
 * @returns { ok: true, path } or { ok: false, code, message }
 */
export function notAttendedDecision({ applicant, interview, offerExists = false, now = new Date() }) {
  if (!applicant) return refuse('not_found');

  // Checked before status: a barred candidate is declined too, and "already on
  // the list" is the answer that tells the manager what actually happened.
  if (applicant.do_not_rehire === true) return refuse('do_not_rehire');
  if (applicant.status !== 'accepted') return refuse('not_accepted');

  if (!interview || !interview.starts_at) return refuse('no_interview');
  if (interview.status === 'attended') return refuse('attended');
  if (interview.status === 'cancelled') return refuse('cancelled');
  if (interview.status !== 'booked' && interview.status !== 'no_show') return refuse('wrong_status');

  // A no-show is a record of something that happened. Before the start time
  // it is a guess -- the same rule the existing attendance button enforces.
  const startsAt = new Date(interview.starts_at);
  if (Number.isNaN(startsAt.getTime())) return refuse('no_interview');
  if (now < startsAt) return refuse('not_started');

  // Decided before `offerExists`: a final-chance interview never has a re-book
  // of its own, and missing it ends the process rather than offering another.
  if (interview.is_final_chance === true) return { ok: true, path: PATHS.final };

  if (offerExists) return refuse('offer_exists');

  return { ok: true, path: PATHS.rebook };
}

/** The button's label for an interview, or null when there is no button. */
export function notAttendedLabel(decision) {
  if (!decision?.ok) return null;
  return decision.path === PATHS.final ? 'Not attended — final' : 'Not attended';
}
