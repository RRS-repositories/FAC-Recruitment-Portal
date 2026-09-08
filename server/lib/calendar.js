import { pool } from './db.js';
import {
  addDays,
  formatTimeIn,
  parseClock,
  zonedDateParts,
  zonedTimeToInstant,
} from './zonedTime.js';

/**
 * The manager's calendar.
 *
 * Read-only, and deliberately so: it shows what the portal already knows —
 * interviews that were booked, time that was blocked, hours that were
 * configured. Nothing here decides anything. A slot it draws as free is free
 * because the availability engine says so, and booking one still goes through
 * that engine, the advisory lock and the exclusion constraint exactly as a
 * candidate's booking does.
 *
 * The grid is built HERE rather than in the browser. Working out which
 * instants make up 09:00–17:00 in Europe/London, across a clock change, is the
 * kind of arithmetic that should exist once — and it already exists here, in
 * the same file the candidate's slot list comes from. A second implementation
 * in the client would be a second chance to get the last Sunday in October
 * wrong.
 */

const INTERVIEWS = `
  SELECT i.id, i.starts_at, i.ends_at, i.status, i.meet_link,
         a.id AS applicant_id, a.full_name, a.email, a.role,
         a.final_score, a.candidate_tz
    FROM recruit_interviews i
    JOIN recruit_applicants a ON a.id = i.applicant_id
   WHERE i.interviewer_id = $1
     AND i.starts_at IS NOT NULL
     AND i.status <> 'cancelled'
     AND i.starts_at < $3
     AND i.ends_at > $2
   ORDER BY i.starts_at
`;

const BLACKOUTS = `
  SELECT id, starts_at, ends_at, reason
    FROM recruit_blackouts
   WHERE interviewer_id = $1
     AND starts_at < $3
     AND ends_at > $2
   ORDER BY starts_at
`;

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Builds the grid for a date range.
 *
 * Dates come in as plain `YYYY-MM-DD` because that is what a calendar is: the
 * manager asked for "this week", not for an instant. They are resolved against
 * the interviewer's own timezone, so the week shown is the week they work.
 */
export async function buildCalendar({ interviewerId, from, to, now = new Date() }) {
  const { rows: ruleRows } = await pool.query(
    'SELECT * FROM recruit_availability_rules WHERE interviewer_id = $1',
    [interviewerId],
  );
  const rule = ruleRows[0];
  if (!rule) return null;

  const zone = rule.timezone;
  const start = zonedTimeToInstant({ ...parseDate(from), hour: 0 }, zone);
  // Exclusive: midnight at the start of the day AFTER the last one asked for.
  const end = zonedTimeToInstant({ ...addDays(parseDate(to), 1), hour: 0 }, zone);

  const [{ rows: interviews }, { rows: blackouts }] = await Promise.all([
    pool.query(INTERVIEWS, [interviewerId, start, end]),
    pool.query(BLACKOUTS, [interviewerId, start, end]),
  ]);

  const dayStart = parseClock(rule.day_start);
  const dayEnd = parseClock(rule.day_end);
  const step = rule.slot_minutes;
  const weekdays = new Set(rule.weekdays);
  const blocks = (rule.blocks ?? []).map((b) => ({
    start: parseClock(b.start),
    end: parseClock(b.end),
    label: b.label ?? 'Blocked',
  }));

  // The earliest a candidate could still take. Slots before it are drawn as
  // past rather than free, so an empty morning does not read as availability
  // nobody took.
  const earliest = new Date(now.getTime() + rule.min_notice_hours * 3_600_000);

  const days = [];
  let cursor = parseDate(from);
  const last = parseDate(to);

  while (!isAfter(cursor, last)) {
    // Ask the zone what weekday this is, at midday — computing it from a UTC
    // date is a day out either side of midnight.
    const probe = zonedTimeToInstant({ ...cursor, hour: 12 }, zone);
    const { weekday } = zonedDateParts(probe, zone);
    const working = weekdays.has(weekday);

    const slots = [];
    for (let minute = dayStart; minute + step <= dayEnd; minute += step) {
      const startsAt = zonedTimeToInstant(
        { ...cursor, hour: Math.floor(minute / 60), minute: minute % 60 },
        zone,
      );
      const endsAt = new Date(startsAt.getTime() + step * 60_000);

      const block = blocks.find((b) => minute < b.end && b.start < minute + step);
      const interview = interviews.find((i) =>
        overlaps(startsAt, endsAt, new Date(i.starts_at), new Date(i.ends_at)),
      );
      const blackout = blackouts.find((b) =>
        overlaps(startsAt, endsAt, new Date(b.starts_at), new Date(b.ends_at)),
      );

      // Order matters: a booked interview is the most important thing a cell
      // can say, and it stays visible even if the day was later blocked.
      let state = 'free';
      if (interview) state = 'booked';
      else if (blackout) state = 'blocked';
      // Closed beats the lunch break: on a Saturday the whole day is shut, and
      // drawing a lunch hour inside it suggests the rest of it is open.
      else if (!working) state = 'closed';
      else if (block) state = 'break';
      else if (startsAt < earliest) state = 'past';

      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        time: formatTimeIn(startsAt, zone),
        state,
        ...(block ? { breakLabel: block.label } : {}),
        ...(blackout ? { blackoutId: blackout.id, blackoutReason: blackout.reason } : {}),
        ...(interview
          ? {
              interview: {
                id: interview.id,
                applicantId: interview.applicant_id,
                fullName: interview.full_name,
                email: interview.email,
                role: interview.role,
                score: interview.final_score,
                status: interview.status,
                localTime: formatTimeIn(interview.starts_at, interview.candidate_tz),
                candidateTz: interview.candidate_tz,
              },
            }
          : {}),
      });
    }

    days.push({
      date: `${cursor.year}-${pad(cursor.month)}-${pad(cursor.day)}`,
      weekday,
      working,
      slots,
      // Counted here so the month view does not have to walk every slot.
      booked: slots.filter((s) => s.state === 'booked').length,
      blocked: slots.filter((s) => s.state === 'blocked').length,
      free: slots.filter((s) => s.state === 'free').length,
    });

    cursor = addDays(cursor, 1);
  }

  return {
    timezone: zone,
    dayStart: rule.day_start,
    dayEnd: rule.day_end,
    slotMinutes: step,
    days,
  };
}

const pad = (n) => String(n).padStart(2, '0');

/** `2026-09-08` → `{ year, month, day }`. Throws rather than guessing. */
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) throw Object.assign(new Error('Dates must look like 2026-09-08.'), { status: 400 });
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const isAfter = (a, b) =>
  a.year > b.year ||
  (a.year === b.year && (a.month > b.month || (a.month === b.month && a.day > b.day)));
