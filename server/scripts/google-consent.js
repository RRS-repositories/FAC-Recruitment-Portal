import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';

/**
 * Gets the refresh token that lets the portal create Meet links as you.
 *
 *   node scripts/google-consent.js <client-id> <client-secret>
 *
 * Run it once, on a machine with a browser. It opens Google's consent page,
 * catches the answer, and prints the one line you paste into .env. Nothing is
 * stored and nothing is sent anywhere else.
 *
 * WHY THIS EXISTS AT ALL. A service account cannot mint a Google Meet link —
 * conferences belong to a real user — and it can only act as a user inside a
 * Workspace domain, where an admin authorises it. There is no admin for
 * gmail.com. So for a personal account the only route is you consenting once
 * in a browser, which is what this does.
 *
 * THE SEVEN-DAY TRAP. While the OAuth consent screen is in "Testing", Google
 * expires refresh tokens after SEVEN DAYS. Everything works, then quietly
 * stops the following week and the first symptom is candidates being told a
 * link will follow. Publish the consent screen ("In production") before
 * running this. The "unverified app" warning you then see is expected for a
 * personal project — continue past it.
 *
 * `prompt: 'consent'` is deliberate: Google returns a refresh token only on
 * the FIRST authorisation for an app, so re-running this without it prints
 * nothing but an access token that dies in an hour.
 */

// Loopback, because Google removed the copy-a-code-from-the-page flow
// (urn:ietf:wg:oauth:2.0:oob) in 2022. A desktop-app client is allowed to use
// any localhost port, so this takes whatever the OS gives it.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/google-consent.js <client-id> <client-secret>');
  console.error('Both come from Google Cloud console → Credentials → OAuth client ID (Desktop app).');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');

const server = http.createServer();
server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const redirectUri = `http://127.0.0.1:${port}`;
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const url = client.generateAuthUrl({
    access_type: 'offline', // without this there is no refresh token at all
    prompt: 'consent',
    scope: SCOPES,
    state,
  });

  console.log('\nOpen this in a browser, signed in as the account that should own the meetings:\n');
  console.log(`  ${url}\n`);
  console.log('Waiting for you to finish…');

  server.on('request', async (req, res) => {
    const asked = new URL(req.url, redirectUri);
    const code = asked.searchParams.get('code');
    const error = asked.searchParams.get('error');

    const reply = (message) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
    };

    // Checked because this port is open on the machine while we wait, and a
    // reply we did not ask for should not be treated as an answer.
    if (asked.searchParams.get('state') !== state) return reply('Unexpected response — ignored.');
    if (error) {
      reply(`Google said: ${error}. You can close this tab.`);
      console.error(`\nRefused: ${error}`);
      server.close();
      process.exit(1);
    }
    if (!code) return reply('No code in that request — ignored.');

    try {
      const { tokens } = await client.getToken(code);
      reply('Done. You can close this tab and go back to the terminal.');

      if (!tokens.refresh_token) {
        console.error('\nGoogle returned no refresh token.');
        console.error('That happens when this app was already authorised by this account.');
        console.error('Remove it at https://myaccount.google.com/permissions and run this again.');
        server.close();
        process.exit(1);
      }

      console.log('\nPaste these three lines into /opt/crm/.env:\n');
      console.log(`RECRUIT_GOOGLE_CLIENT_ID=${clientId}`);
      console.log(`RECRUIT_GOOGLE_CLIENT_SECRET=${clientSecret}`);
      console.log(`RECRUIT_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\nThe refresh token is a credential: it belongs in .env and nowhere else.');
      console.log('Never in git — both repositories are public.\n');
    } catch (failure) {
      reply('Something went wrong. Check the terminal.');
      console.error(`\nCould not exchange the code: ${failure.message}`);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
});
