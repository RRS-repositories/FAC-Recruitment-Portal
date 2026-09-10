import test from 'node:test';
import assert from 'node:assert/strict';

import { calendarMode, CalendarError, resetCalendarClient } from './googleCalendar.js';

/**
 * What is worth pinning without a Google account attached: that the feature is
 * off unless it is completely configured, and that a revoked token is told
 * apart from a bad afternoon. The rest — whether a personal account may mint a
 * conference at all — is answered by scripts/verify-meet.js against a real
 * account, because no test here could tell you.
 */

const KEYS = ['RECRUIT_GOOGLE_CLIENT_ID', 'RECRUIT_GOOGLE_CLIENT_SECRET', 'RECRUIT_GOOGLE_REFRESH_TOKEN'];

function withEnv(values, run) {
  const had = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
  resetCalendarClient();
  try {
    run();
  } finally {
    for (const k of KEYS) {
      if (had[k] === undefined) delete process.env[k];
      else process.env[k] = had[k];
    }
    resetCalendarClient();
  }
}

test('all three credentials, or it is off', () => {
  withEnv({}, () => assert.equal(calendarMode(), 'off'));
  withEnv({ RECRUIT_GOOGLE_CLIENT_ID: 'a' }, () => assert.equal(calendarMode(), 'off'));
  withEnv({ RECRUIT_GOOGLE_CLIENT_ID: 'a', RECRUIT_GOOGLE_CLIENT_SECRET: 'b' }, () =>
    assert.equal(calendarMode(), 'off'),
  );
  withEnv(
    { RECRUIT_GOOGLE_CLIENT_ID: 'a', RECRUIT_GOOGLE_CLIENT_SECRET: 'b', RECRUIT_GOOGLE_REFRESH_TOKEN: 'c' },
    () => assert.equal(calendarMode(), 'on'),
  );
});

test('a half-configured calendar is off, not broken', async () => {
  // The worst outcome would be attempting a call with two of three values and
  // failing per booking. Off is a state the rest of the system understands.
  await withEnv({ RECRUIT_GOOGLE_CLIENT_ID: 'a', RECRUIT_GOOGLE_CLIENT_SECRET: 'b' }, () => {
    assert.equal(calendarMode(), 'off');
  });
});

test('errors carry whether they are worth retrying', () => {
  assert.equal(new CalendarError('x').retryable, true, 'unknown failures are worth another try');
  assert.equal(new CalendarError('x', { retryable: false }).retryable, false);
});
