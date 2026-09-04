/**
 * Timezone helpers for interview scheduling.
 *
 * Availability rules are held in ONE zone — Europe/London — and converted
 * outward for each candidate. That matters because the UK observes daylight
 * saving and neither India (IST, UTC+5:30) nor South Africa (SAST, UTC+2)
 * does, so the UK is the only clock that moves. Anchoring the rules to it and
 * converting means a 09:00 slot stays 09:00 to the business all year, while
 * the candidate's displayed time shifts with the UK clock change — which is
 * the correct behaviour, not a bug.
 */

export const INTERVIEW_TZ = process.env.INTERVIEW_TIMEZONE || 'Europe/London';

export const CANDIDATE_TZ = {
  india_intern: 'Asia/Kolkata',
  sa_paralegal: 'Africa/Johannesburg',
};

/** Formats an instant as HH:mm in the given zone. */
export function formatTime(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}

/** Formats an instant as a readable date + time in the given zone. */
export function formatDateTime(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}

/**
 * The UTC offset, in minutes, that `timeZone` was at a given instant.
 * Used to turn a wall-clock rule ("09:00 UK") into a real instant on a given
 * day, correctly on both sides of a daylight-saving change.
 */
export function offsetMinutes(instant, timeZone) {
  const asUTC = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  const asZone = new Date(instant.toLocaleString('en-US', { timeZone }));
  return Math.round((asZone - asUTC) / 60000);
}
