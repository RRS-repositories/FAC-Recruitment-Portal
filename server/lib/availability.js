import {
  addDays,
  formatDayIn,
  formatTimeIn,
  parseClock,
  zonedDateParts,
  zonedTimeToInstant,
} from './zonedTime.js';

/**
 * Which interview slots a candidate may actually pick.
 *
 * Build spec §5, in order. Six of the seven filters are ours; the seventh —
 * "and not when the interviewer has his own meetings" — is Google's freebusy
 * and arrives in the next stage as one more `taken` source. Nothing here needs
 * to change to accommodate it, which is why the two were separated.
 *
 * All arithmetic is on absolute instants. Wall-clock times exist only in the
 * rule (held in the interviewer's business timezone, Europe/London) and in the
 * strings handed to the candidate.
 */

/**
 * Generates the slots a rule allows on one calendar date, before any
 * exclusions. Times are built in the rule's zone, so a UK clock change moves
 * the resulting instants rather than shifting the working day.
 */
function slotsForDate(date, rule) {
  const dayStart = parseClock(rule.day_start);
  const dayEnd = parseClock(rule.day_end);
  const step = rule.slot_minutes;
  const slots = [];

  for (let minute = dayStart; minute + step <= dayEnd; minute += step) {
    const startsAt = zonedTimeToInstant(
      { year: date.year, month: date.month, day: date.day, hour: Math.floor(minute / 60), minute: minute % 60 },
      rule.timezone,
    );
    const endsAt = new Date(startsAt.getTime() + step * 60_000);

    slots.push({ startsAt, endsAt, startMinute: minute, endMinute: minute + step });
  }

  return slots;
}

/** True if [aStart, aEnd) and [bStart, bEnd) share any moment. */
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Builds the bookable slots for a candidate.
 *
 * @param rule    a recruit_availability_rules row
 * @param taken   [{ startsAt, endsAt }] — existing bookings, and later
 *                Google's busy periods; both are just intervals to avoid
 * @param now     injectable so tests are not at the mercy of the clock
 */
export function buildAvailability({ rule, taken = [], candidateTimezone, now = new Date() }) {
  const buffer = (rule.buffer_minutes ?? 0) * 60_000;
  const earliest = new Date(now.getTime() + rule.min_notice_hours * 3_600_000);
  const allowedWeekdays = new Set(rule.weekdays);

  // Blocked periods (lunch) are wall-clock ranges in the rule's zone, so they
  // are compared in minutes-of-day rather than as instants — that way they
  // stay at 11:30 whatever the clock is doing.
  const blocks = (rule.blocks ?? []).map((b) => ({
    start: parseClock(b.start),
    end: parseClock(b.end),
    label: b.label ?? 'Unavailable',
  }));

  const days = [];
  const today = zonedDateParts(now, rule.timezone);

  for (let offset = 0; offset <= rule.max_days_ahead; offset += 1) {
    const date = addDays(today, offset);
    // Ask the zone what weekday this date is, rather than computing it from a
    // UTC date, which can be a day out either side of midnight.
    const probe = zonedTimeToInstant({ ...date, hour: 12 }, rule.timezone);
    const { weekday } = zonedDateParts(probe, rule.timezone);
    if (!allowedWeekdays.has(weekday)) continue;

    const slots = [];

    for (const slot of slotsForDate(date, rule)) {
      // 2. Lunch, and any other blocked window.
      if (blocks.some((b) => slot.startMinute < b.end && b.start < slot.endMinute)) continue;

      // 3. The slot's END must fall inside the working day. Handled by the
      //    generator's `minute + step <= dayEnd`, so a 16:45 start is never
      //    produced for a 17:00 finish.

      // 4. Minimum notice.
      if (slot.startsAt < earliest) continue;

      // 6. Already booked, plus any buffer either side.
      const clashes = taken.some((t) =>
        overlaps(
          slot.startsAt.getTime() - buffer,
          slot.endsAt.getTime() + buffer,
          new Date(t.startsAt).getTime(),
          new Date(t.endsAt).getTime(),
        ),
      );
      if (clashes) continue;

      slots.push({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        // 7. Shown in the candidate's own zone, with UK time alongside so
        //    both sides can talk about the same moment without confusion.
        localTime: formatTimeIn(slot.startsAt, candidateTimezone),
        ukTime: formatTimeIn(slot.startsAt, rule.timezone),
      });
    }

    if (slots.length > 0) {
      const firstSlot = new Date(slots[0].startsAt);
      days.push({
        date: `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`,
        localLabel: formatDayIn(firstSlot, candidateTimezone),
        slots,
      });
    }
  }

  return days;
}

/**
 * Re-checks one chosen slot at the moment of booking.
 *
 * The list a candidate is looking at may be minutes old, and someone else may
 * have taken the slot since. This is the authority — never the list.
 */
export function isSlotBookable({ startsAt, rule, taken = [], now = new Date() }) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: 'That is not a valid time.' };

  const end = new Date(start.getTime() + rule.slot_minutes * 60_000);
  const { weekday, ...date } = zonedDateParts(start, rule.timezone);

  if (!rule.weekdays.includes(weekday)) {
    return { ok: false, reason: 'That day is not available.' };
  }

  // Must be a slot the generator would actually have produced — not merely a
  // plausible-looking time. Stops a hand-made request booking 09:07.
  const valid = slotsForDate(date, rule).some((s) => s.startsAt.getTime() === start.getTime());
  if (!valid) return { ok: false, reason: 'That is not one of the available times.' };

  const blocks = (rule.blocks ?? []).map((b) => ({ start: parseClock(b.start), end: parseClock(b.end) }));
  const minuteOfDay = (() => {
    const [h, m] = formatTimeIn(start, rule.timezone).split(':').map(Number);
    return h * 60 + m;
  })();
  const endMinute = minuteOfDay + rule.slot_minutes;

  if (blocks.some((b) => minuteOfDay < b.end && b.start < endMinute)) {
    return { ok: false, reason: 'That time is not available.' };
  }
  if (endMinute > parseClock(rule.day_end)) {
    return { ok: false, reason: 'That time is outside interview hours.' };
  }
  if (start < new Date(now.getTime() + rule.min_notice_hours * 3_600_000)) {
    return { ok: false, reason: `Please choose a time at least ${rule.min_notice_hours} hours from now.` };
  }

  const latest = zonedTimeToInstant(
    { ...addDays(zonedDateParts(now, rule.timezone), rule.max_days_ahead + 1), hour: 0 },
    rule.timezone,
  );
  if (start >= latest) {
    return { ok: false, reason: `Please choose a time within the next ${rule.max_days_ahead} days.` };
  }

  const buffer = (rule.buffer_minutes ?? 0) * 60_000;
  const clashes = taken.some((t) =>
    overlaps(
      start.getTime() - buffer,
      end.getTime() + buffer,
      new Date(t.startsAt).getTime(),
      new Date(t.endsAt).getTime(),
    ),
  );
  if (clashes) return { ok: false, reason: 'That time has just been taken. Please choose another.' };

  return { ok: true, startsAt: start, endsAt: end };
}
