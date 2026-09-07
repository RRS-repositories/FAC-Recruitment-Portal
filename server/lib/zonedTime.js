/**
 * Converting between wall-clock time in a named zone and real instants.
 *
 * JavaScript has no built-in way to say "09:00 on this date in Europe/London"
 * and get back a UTC instant. `new Date(y, m, d, h)` uses the *server's* zone,
 * which is wrong the moment the server is not in London — and on the
 * production box it is UTC.
 *
 * Everything downstream of this file works in absolute instants. Wall-clock
 * strings appear only at the two edges: reading the availability rule, and
 * displaying a time to a person.
 */

/**
 * The offset, in milliseconds, that `timeZone` was at a given instant.
 * Derived by asking Intl what the local wall clock reads there and taking the
 * difference — the only reliable way, since offsets change with DST.
 */
export function offsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const at = {};
  for (const part of parts) at[part.type] = part.value;

  const asIfUtc = Date.UTC(
    Number(at.year),
    Number(at.month) - 1,
    Number(at.day),
    // Some locales render midnight as hour 24; normalise it.
    Number(at.hour) % 24,
    Number(at.minute),
    Number(at.second),
  );

  return asIfUtc - instant.getTime();
}

/**
 * "This wall-clock time, in this zone" → the instant it happens.
 *
 * Two passes, and the second one matters. The first guess uses the offset in
 * force at the *provisional* instant, which can be on the wrong side of a
 * daylight-saving change; re-measuring at the corrected instant settles it.
 * Without this, times within an hour of a transition land an hour out.
 */
export function zonedTimeToInstant({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = offsetMs(new Date(guess), timeZone);
  const corrected = new Date(guess - firstOffset);
  const secondOffset = offsetMs(corrected, timeZone);
  return new Date(guess - secondOffset);
}

/** The calendar date showing on the wall clock in `timeZone` at `instant`. */
export function zonedDateParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(instant);

  const at = {};
  for (const part of parts) at[part.type] = part.value;

  const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

  return {
    year: Number(at.year),
    month: Number(at.month),
    day: Number(at.day),
    // ISO numbering: Monday is 1, matching recruit_availability_rules.weekdays.
    weekday: WEEKDAY[at.weekday],
    iso: `${at.year}-${at.month}-${at.day}`,
  };
}

/** Adds whole days to a calendar date, without touching time-of-day. */
export function addDays({ year, month, day }, count) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + count);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** "HH:MM" → minutes since midnight. */
export function parseClock(value) {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + (m || 0);
}

export const formatTimeIn = (instant, timeZone) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(instant);

export const formatDayIn = (instant, timeZone) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
    .format(instant);
