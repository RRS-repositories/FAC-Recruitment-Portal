import { ROLE_BY_API_KEY } from '../lib/roles.js';
import { formatDayIn, formatTimeIn } from '../lib/zonedTime.js';

/**
 * What every email needs to know, fetched at the moment of sending.
 *
 * This is the function that makes "resolve merge fields late" real. A reminder
 * queued twenty-four hours ago asks this for the interview time now, so a
 * candidate who moved their slot in the meantime is told the time they
 * actually have — not the one they had when the reminder was written.
 *
 * Every field is safe to interpolate into a plain-text email. Nothing here is
 * a secret: the booking token cannot be re-derived and travels separately, in
 * the queued row's `vars`.
 */

const UK = 'Europe/London';

const ONE = `
  SELECT a.id            AS applicant_id,
         a.full_name, a.email, a.role, a.candidate_tz, a.status AS applicant_status,
         i.id            AS interview_id,
         i.starts_at, i.ends_at, i.status AS interview_status,
         i.meet_link, i.reschedule_count,
         iv.full_name    AS interviewer_name,
         iv.email        AS interviewer_email,
         iv.personal_timezone AS interviewer_tz
    FROM recruit_applicants a
    LEFT JOIN recruit_interviews i  ON i.id = $2
    LEFT JOIN recruit_interviewers iv ON iv.id = i.interviewer_id
   WHERE a.id = $1
`;

/** "Priyanshu Srivastava" → "Priyanshu". Used to sign off warmly but briefly. */
const firstNameOf = (full) => (full ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * Where booking links point.
 *
 * In production this is the public hostname; in development it is the dev
 * server, so a link in a file-written email is one you can actually click.
 */
export const publicBaseUrl = () =>
  (process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');

export async function loadContext(row, db) {
  const { rows } = await db.query(ONE, [row.applicant_id, row.interview_id]);
  const record = rows[0];
  if (!record) throw new Error(`applicant ${row.applicant_id} no longer exists`);

  const role = ROLE_BY_API_KEY[record.role] ?? null;
  const tz = record.candidate_tz || role?.timezone || UK;

  const context = {
    firstName: firstNameOf(record.full_name),
    fullName: record.full_name,
    email: record.email,

    roleTitle: role?.title ?? 'the role',
    roleCountry: role?.country ?? '',
    roleSlug: role?.slug ?? '',

    interviewerName: record.interviewer_name ?? 'a member of our team',
    interviewerFirstName: firstNameOf(record.interviewer_name),
    interviewerEmail: record.interviewer_email ?? null,
    interviewerTimezone: record.interviewer_tz || UK,

    applicantStatus: record.applicant_status,
    interviewStatus: record.interview_status,
    rescheduleCount: record.reschedule_count ?? 0,
    meetLink: record.meet_link ?? null,

    // Filled in below only when there is a time to talk about.
    localDay: null,
    localTime: null,
    ukTime: null,
    // The same instant in the interviewer's own day. Their zone is not the
    // candidate's and need not be the UK one either, so the email that tells
    // them to be somewhere has to say it in the time they live in.
    interviewerDay: null,
    interviewerTime: null,
    timezone: tz,
    startsAt: record.starts_at ?? null,
    endsAt: record.ends_at ?? null,
  };

  if (record.starts_at) {
    // Both zones, always. A cross-timezone interview that names one bare time
    // is how people join an hour late.
    context.localDay = formatDayIn(record.starts_at, tz);
    context.localTime = formatTimeIn(record.starts_at, tz);
    context.ukTime = formatTimeIn(record.starts_at, UK);
    context.interviewerDay = formatDayIn(record.starts_at, context.interviewerTimezone);
    context.interviewerTime = formatTimeIn(record.starts_at, context.interviewerTimezone);
  }

  return context;
}

/** The sign-off every email shares, so it cannot drift between them. */
export const SIGN_OFF = 'Kind regards,\nRecruitment Team\nFast Action Claims\nRowan Rose Ltd';

/**
 * The line that names the time, in both zones.
 *
 * One function rather than seven copies: if the wording changes, it changes
 * everywhere, and no email can end up disagreeing with another about how a
 * time is written.
 */
export const whenLine = (data) =>
  data.localDay && data.localTime
    ? `${data.localDay} at ${data.localTime} (${data.ukTime} UK time)`
    : 'a time still to be chosen';

/**
 * What to say about joining.
 *
 * Stage 7 populates `meet_link`. Until it does, promising a link that nothing
 * creates would be a lie the candidate discovers on the day — so the wording
 * changes with the fact, and improves on its own when the column fills.
 */
export const joinLine = (data) =>
  data.meetLink
    ? `Join here: ${data.meetLink}`
    : 'We will email you the video link before your interview.';
