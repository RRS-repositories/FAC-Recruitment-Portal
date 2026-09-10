import { google } from 'googleapis';

/**
 * Proves — or disproves — that this account can mint a Google Meet link.
 *
 *   node scripts/verify-meet.js <client-id> <client-secret> <refresh-token>
 *
 * Creates one throwaway event tomorrow, asks whether a Meet link came back,
 * prints it, and deletes the event again. Nothing is left behind and nobody is
 * invited.
 *
 * WHY THIS RUNS BEFORE THE FEATURE IS BUILT. The whole automation rests on one
 * assumption: that a personal Google account is allowed to create conferences
 * through the Calendar API. If it is not, every stage after this is wasted
 * work, and the failure would otherwise surface as candidates quietly being
 * told a link will follow.
 *
 * It is also the check to re-run after rotating the token, or after moving
 * from a personal account to a Workspace one.
 *
 * THE QUIET FAILURE THIS EXISTS TO CATCH. Omit `conferenceDataVersion: 1`, or
 * the `createRequest`, and Google cheerfully returns a created event with no
 * conference attached and no error at all. So this asserts the link is
 * present rather than assuming the absence of an exception means success.
 */

const [clientId, clientSecret, refreshToken] = process.argv.slice(2);
if (!clientId || !clientSecret || !refreshToken) {
  console.error('Usage: node scripts/verify-meet.js <client-id> <client-secret> <refresh-token>');
  console.error('All three come from scripts/google-consent.js.');
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });
const calendar = google.calendar({ version: 'v3', auth });

const start = new Date(Date.now() + 24 * 3600 * 1000);
const end = new Date(start.getTime() + 30 * 60 * 1000);

let created = null;
try {
  console.log(`\nCreating a throwaway event at ${start.toISOString()} …`);
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1, // without this: an event, no link, no error
    sendUpdates: 'none',
    requestBody: {
      summary: '[test] recruitment portal — Meet link check',
      description: 'Created by scripts/verify-meet.js. Deleted automatically.',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `verify-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });
  created = data.id;

  const link =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null;

  console.log(`  event created: ${data.id}`);
  console.log(`  organiser    : ${data.organizer?.email ?? '(unknown)'}`);

  if (link) {
    console.log(`\n  MEET LINK    : ${link}`);
    console.log('\nYES — this account can create Meet links. The automation will work.');
  } else {
    console.log('\n  conferenceData:', JSON.stringify(data.conferenceData ?? null));
    console.log('\nNO — the event was created but carries no Meet link.');
    console.log('This account cannot mint conferences through the API, so the');
    console.log('automation cannot work as planned. A Workspace account can.');
    process.exitCode = 2;
  }
} catch (error) {
  const detail = error?.response?.data?.error;
  console.error(`\nFAILED: ${error.message}`);
  if (detail) console.error(`  ${JSON.stringify(detail).slice(0, 400)}`);
  console.error('\nCommon causes: Calendar API not enabled on the project; the');
  console.error('consent screen left in "Testing" so the refresh token has expired');
  console.error('(seven days); or access revoked at myaccount.google.com/permissions.');
  process.exitCode = 1;
} finally {
  if (created) {
    await calendar.events
      .delete({ calendarId: 'primary', eventId: created, sendUpdates: 'none' })
      .then(() => console.log('\n  (test event deleted)'))
      .catch((e) => console.error(`\n  could not delete the test event ${created}: ${e.message}`));
  }
}
