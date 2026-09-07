import { enqueue, cancelPendingFor } from './outbox.js';
import { dedupeKey } from './outboxPolicy.js';

/**
 * Which email each event sends.
 *
 * One place, so the routes stay about what they do rather than what they
 * announce, and so the answer to "what does a candidate receive when X
 * happens" is readable in a single file.
 *
 * Every function here takes a transaction client. That is the whole point: the
 * email is queued in the same transaction as the thing that caused it, so a
 * decision cannot be recorded without its email, and no email goes out for a
 * decision that rolled back.
 */

const ACCEPT_TEMPLATE = {
  india_intern: 'recruit.india.accept',
  sa_paralegal: 'recruit.sa.accept',
};
const DECLINE_TEMPLATE = {
  india_intern: 'recruit.india.decline',
  sa_paralegal: 'recruit.sa.decline',
};

const HOUR = 3_600_000;

/** "Thanks, we have it." */
export const notifyApplicationReceived = (client, applicant) =>
  enqueue(client, {
    template: 'recruit.ack',
    toEmail: applicant.email,
    toName: applicant.full_name,
    applicantId: applicant.id,
    dedupeKey: dedupeKey('ack', applicant.id),
  });

/**
 * Accepted or declined.
 *
 * The booking token is passed through because it cannot be recovered: it is
 * returned by the accept transaction once and stored only as a hash. It is
 * also why the dedupe key includes it — reissuing a link is a deliberate
 * second send of this same email, with a different link inside.
 */
export function notifyDecision(client, { applicant, status, bookingToken = null }) {
  const template =
    status === 'accepted' ? ACCEPT_TEMPLATE[applicant.role] : DECLINE_TEMPLATE[applicant.role];
  if (!template) throw new Error(`no decision email for role ${applicant.role}`);

  return enqueue(client, {
    template,
    toEmail: applicant.email,
    toName: applicant.full_name,
    applicantId: applicant.id,
    vars: bookingToken ? { token: bookingToken } : {},
    dedupeKey: dedupeKey('decision', applicant.id, status, bookingToken?.slice(0, 12)),
  });
}

/**
 * A slot was chosen, or moved.
 *
 * Queues the confirmation and both reminders in one go. The reminders are just
 * rows with a future `send_after` — there is no scheduler to keep in step with
 * this, which is the reason the queue was built this way.
 *
 * Reminders are keyed on the START TIME as well as the interview, so moving an
 * interview produces genuinely new rows rather than colliding with the ones
 * for the old slot. The old ones are cancelled first.
 */
export async function notifyBooked(client, { applicant, interviewId, startsAt, isReschedule = false }) {
  const when = new Date(startsAt);

  // Anything still queued for the previous time is now wrong. Cancelled, not
  // deleted, so the record of what was planned survives.
  if (isReschedule) await cancelPendingFor(client, interviewId, 'interview moved');

  const common = {
    toEmail: applicant.email,
    toName: applicant.full_name,
    applicantId: applicant.id,
    interviewId,
  };

  await enqueue(client, {
    ...common,
    template: isReschedule ? 'recruit.rescheduled' : 'recruit.booking.confirmed',
    dedupeKey: dedupeKey(isReschedule ? 'moved' : 'confirmed', interviewId, when),
  });

  // A reminder is only worth sending while there is still time to act on it.
  // Booking is at least 24 hours ahead, so this normally lands; a reschedule
  // into tomorrow morning can legitimately leave no room for it.
  const dayBefore = new Date(when.getTime() - 24 * HOUR);
  if (dayBefore.getTime() - Date.now() > HOUR) {
    await enqueue(client, {
      ...common,
      template: 'recruit.reminder.24h',
      sendAfter: dayBefore,
      dedupeKey: dedupeKey('reminder24', interviewId, when),
    });
  }

  const tenBefore = new Date(when.getTime() - 10 * 60_000);
  if (tenBefore.getTime() > Date.now()) {
    await enqueue(client, {
      ...common,
      template: 'recruit.reminder.10m',
      sendAfter: tenBefore,
      dedupeKey: dedupeKey('reminder10', interviewId, when),
    });
  }
}

/** Cancelled by the candidate. Their reminders must not still arrive. */
export async function notifyCancelled(client, { applicant, interviewId }) {
  await cancelPendingFor(client, interviewId, 'interview cancelled');

  return enqueue(client, {
    template: 'recruit.cancelled',
    toEmail: applicant.email,
    toName: applicant.full_name,
    applicantId: applicant.id,
    interviewId,
    dedupeKey: dedupeKey('cancelled', interviewId, Date.now()),
  });
}

/**
 * They did not turn up.
 *
 * Carries a fresh booking link, because the offer is worth nothing without
 * one. Keyed on the interview alone, so marking someone a no-show twice — or
 * correcting to attended and back — cannot send this a second time.
 */
export const notifyNoShow = (client, { applicant, interviewId, bookingToken }) =>
  enqueue(client, {
    template: 'recruit.noshow',
    toEmail: applicant.email,
    toName: applicant.full_name,
    applicantId: applicant.id,
    interviewId,
    vars: { token: bookingToken },
    dedupeKey: dedupeKey('noshow', interviewId),
  });
