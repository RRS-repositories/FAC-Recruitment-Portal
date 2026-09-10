import { randomUUID } from 'node:crypto';

/**
 * Google Calendar, for the one thing it is here to do: mint a Meet link.
 *
 * Same shape as `llm.js` and the mailer, so there is one way to read "is this
 * actually on?".
 *
 *   all three RECRUIT_GOOGLE_* set  → interviews get a Meet link
 *   any missing                     → nothing is created, and the API says so
 *
 * WHY OAUTH AND NOT A SERVICE ACCOUNT. A service account cannot create a Meet
 * conference — conferences belong to a real user — and it can only act as one
 * inside a Workspace domain, where an admin authorises it. There is no admin
 * for gmail.com. So a person consents once in a browser
 * (scripts/google-consent.js) and the refresh token does the rest, unattended,
 * for ever.
 *
 * Moving to a company Workspace account later is three different values in
 * .env. Nothing in this file changes.
 *
 * RECRUIT_-PREFIXED, like the Ollama variables and for the same reason: this
 * module shares a process and an .env with the CRM, which has its own Google
 * credentials, and dotenv takes the last definition of a key.
 */

const TIMEOUT_MS = Number(process.env.RECRUIT_GOOGLE_TIMEOUT_MS || 20_000);

/**
 * Whether the candidate is put on the invitation.
 *
 * On by default. Without it an external guest has to knock and wait to be
 * admitted, which is a poor first impression if the interviewer is a minute
 * late. Google's own emails are suppressed either way, so the candidate still
 * hears from us in one voice rather than getting a second, differently worded
 * message from Google.
 */
const inviteCandidate = () => process.env.RECRUIT_GOOGLE_INVITE_CANDIDATE !== 'false';

export const calendarMode = () =>
  process.env.RECRUIT_GOOGLE_CLIENT_ID &&
  process.env.RECRUIT_GOOGLE_CLIENT_SECRET &&
  process.env.RECRUIT_GOOGLE_REFRESH_TOKEN
    ? 'on'
    : 'off';

export class CalendarError extends Error {
  constructor(message, { retryable = true } = {}) {
    super(message);
    this.name = 'CalendarError';
    // A revoked token fails identically for ever; a 503 does not. The retry
    // job needs to tell them apart or it spends its budget on the hopeless.
    this.retryable = retryable;
  }
}

/** Built once. googleapis refreshes the access token itself from here on. */
let client = null;
async function calendar() {
  if (client) return client;
  if (calendarMode() === 'off') {
    throw new CalendarError('RECRUIT_GOOGLE_* credentials are not set', { retryable: false });
  }
  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2(
    process.env.RECRUIT_GOOGLE_CLIENT_ID,
    process.env.RECRUIT_GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.RECRUIT_GOOGLE_REFRESH_TOKEN });
  client = google.calendar({ version: 'v3', auth, timeout: TIMEOUT_MS });
  return client;
}

/** Only for tests, and for picking up a rotated token without a restart. */
export const resetCalendarClient = () => {
  client = null;
};

/**
 * Turns whatever googleapis threw into something the retry job can act on.
 *
 * `invalid_grant` is the one that matters: the refresh token has been revoked
 * or expired — which is what happens seven days after consent if the OAuth
 * screen was left in "Testing". Retrying that for ever would bury the one
 * error somebody actually has to act on.
 */
function classify(error, what) {
  const status = error?.response?.status ?? error?.code;
  const detail = error?.response?.data?.error;
  const reason = typeof detail === 'string' ? detail : detail?.message || error.message;

  if (reason && /invalid_grant/i.test(String(reason))) {
    return new CalendarError(
      `${what}: the Google refresh token is no longer valid — re-run scripts/google-consent.js ` +
        '(and check the OAuth consent screen is published, not in "Testing")',
      { retryable: false },
    );
  }
  const permanent = [400, 401, 403, 404].includes(Number(status));
  return new CalendarError(`${what}: ${status ?? 'error'} ${String(reason).slice(0, 200)}`, {
    retryable: !permanent,
  });
}

/**
 * Creates the interview event and returns its Meet link.
 *
 * THE QUIET FAILURE THIS GUARDS AGAINST. Omit `conferenceDataVersion: 1`, or
 * the `createRequest`, and Google returns a perfectly good event with no
 * conference attached and no error whatsoever. The link is therefore asserted,
 * not assumed: no link means this threw, and the retry job tries again.
 */
export async function createInterviewEvent({
  calendarId = 'primary',
  startsAt,
  endsAt,
  candidateName,
  candidateEmail,
  interviewerName,
  interviewerEmail,
  roleTitle,
}) {
  const cal = await calendar();

  const attendees = [];
  if (inviteCandidate() && candidateEmail) {
    attendees.push({ email: candidateEmail, displayName: candidateName, responseStatus: 'needsAction' });
  }
  if (interviewerEmail) attendees.push({ email: interviewerEmail, displayName: interviewerName });

  let data;
  try {
    ({ data } = await cal.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      // Ours is the only email the candidate should receive about this. Google
      // sending its own would be a second voice saying it differently.
      sendUpdates: 'none',
      requestBody: {
        summary: `Interview — ${candidateName}${roleTitle ? ` (${roleTitle})` : ''}`,
        description: `Recruitment interview with ${candidateName} <${candidateEmail}>.`,
        start: { dateTime: new Date(startsAt).toISOString() },
        end: { dateTime: new Date(endsAt).toISOString() },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    }));
  } catch (error) {
    throw classify(error, 'could not create the calendar event');
  }

  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null;

  if (!meetLink) {
    throw new CalendarError(
      'the event was created but Google attached no Meet link — this account may not be able to ' +
        'create conferences through the API',
      // Worth one more try in case it was transient, but if it is the account
      // it will fail the same way and the error says what to look at.
      { retryable: true },
    );
  }

  return { meetLink, eventId: data.id, htmlLink: data.htmlLink ?? null };
}

/** Moves an existing event. The Meet link survives, which is the point. */
export async function moveInterviewEvent({ calendarId = 'primary', eventId, startsAt, endsAt }) {
  const cal = await calendar();
  try {
    const { data } = await cal.events.patch({
      calendarId,
      eventId,
      sendUpdates: 'none',
      requestBody: {
        start: { dateTime: new Date(startsAt).toISOString() },
        end: { dateTime: new Date(endsAt).toISOString() },
      },
    });
    return { eventId: data.id };
  } catch (error) {
    throw classify(error, 'could not move the calendar event');
  }
}

/**
 * Cancels the event.
 *
 * An event already gone is success, not failure: the desired state is "no
 * interview in the calendar", and something else having got there first is
 * not a problem to report.
 */
export async function cancelInterviewEvent({ calendarId = 'primary', eventId }) {
  const cal = await calendar();
  try {
    await cal.events.delete({ calendarId, eventId, sendUpdates: 'none' });
    return { cancelled: true };
  } catch (error) {
    const status = Number(error?.response?.status ?? error?.code);
    if (status === 404 || status === 410) return { cancelled: true, alreadyGone: true };
    throw classify(error, 'could not cancel the calendar event');
  }
}

/**
 * Whether Google answers, said at boot beside verifyMail and verifyLlm.
 *
 * A revoked token should be visible on deploy, not on the morning of an
 * interview. Reads one calendar rather than creating anything.
 */
export async function verifyCalendar() {
  if (calendarMode() === 'off') {
    return { ok: false, mode: 'off', detail: 'RECRUIT_GOOGLE_* is not set, so no Meet link is created' };
  }
  try {
    const cal = await calendar();
    const { data } = await cal.calendars.get({ calendarId: 'primary' });
    return {
      ok: true,
      mode: 'on',
      detail: `${data.summary ?? 'primary'}${inviteCandidate() ? ', candidate invited' : ''}`,
    };
  } catch (error) {
    return { ok: false, mode: 'on', detail: classify(error, 'calendar unreachable').message };
  }
}
