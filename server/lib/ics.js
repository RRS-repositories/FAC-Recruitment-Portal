/**
 * A calendar attachment for the confirmation email.
 *
 * Hand-written rather than pulled from a package: iCalendar is a small, stable
 * text format, and the alternative was a dependency for forty lines of string
 * building. What it does need is care — the rules below are the ones that
 * actually break calendars when ignored.
 *
 * This is not the Google Calendar event. That is stage 7, created on the
 * interviewer's calendar. This is the thing a candidate can add to their own,
 * which is a different job and worth doing now rather than waiting.
 */

/** iCalendar wants UTC as 20260908T130000Z — no dashes, no colons, no millis. */
const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Escapes a value for a text field.
 *
 * Commas and semicolons separate values in this format, so an unescaped one in
 * a candidate's name would silently truncate the field or shift the rest of
 * the line into the wrong property.
 */
const escape = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Folds a line to 75 octets, as the format requires.
 *
 * Long DESCRIPTION lines are the usual casualty: some clients simply drop a
 * line that runs over, so the candidate gets an event with no details.
 */
function fold(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

export function buildIcs({ uid, startsAt, endsAt, summary, description, location, organiserEmail, attendeeEmail }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fast Action Claims//Recruitment Portal//EN',
    'CALSCALE:GREGORIAN',
    // REQUEST would make this a formal invitation the candidate can accept or
    // decline, and there is nothing on our side listening for that reply.
    // PUBLISH is honest: here is an event, add it if you like.
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escape(uid)}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(endsAt)}`,
    `SUMMARY:${escape(summary)}`,
    `DESCRIPTION:${escape(description)}`,
    location ? `LOCATION:${escape(location)}` : null,
    organiserEmail ? `ORGANIZER:mailto:${escape(organiserEmail)}` : null,
    attendeeEmail ? `ATTENDEE;CN=${escape(attendeeEmail)}:mailto:${escape(attendeeEmail)}` : null,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  // CRLF between lines is required by the format, not a Windows habit.
  return lines.map(fold).join('\r\n');
}

export default buildIcs;
