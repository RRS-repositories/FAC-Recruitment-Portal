import test from 'node:test';
import assert from 'node:assert/strict';

import { calendarMode, CalendarError, extraGuests, interviewAttendees, resetCalendarClient } from './googleCalendar.js';
import { extendedRole } from './extendedRoles.js';

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

/* ── Extra guests who join without knocking ──────────────────────────────── */


test('extra guests: none configured means nobody is added', () => {
  assert.deepEqual(extraGuests({}), []);
  assert.deepEqual(extraGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: '' }), []);
  assert.deepEqual(extraGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: '   ' }), []);
});

test('extra guests: a comma-separated list is trimmed and lowercased', () => {
  assert.deepEqual(
    extraGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: ' Joe@Example.co.uk , second@example.com' }),
    ['joe@example.co.uk', 'second@example.com'],
  );
});

test('extra guests: a typo is dropped rather than sent to Google', () => {
  // Google rejects the WHOLE event over one malformed attendee, which would
  // leave the interview with no Meet link at all.
  assert.deepEqual(
    extraGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: 'joe@example.co.uk, not-an-address, @nope, a@b' }),
    ['joe@example.co.uk'],
  );
});

test('extra guests: the same person listed twice is added once', () => {
  assert.deepEqual(
    extraGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: 'joe@example.co.uk,JOE@example.co.uk' }),
    ['joe@example.co.uk'],
  );
});

/* ── Guests one role adds to its own interviews ──────────────────────────── */

const PEOPLE = {
  candidateName: 'Cand Idate',
  candidateEmail: 'candidate@example.com',
  interviewerName: 'Inter Viewer',
  interviewerEmail: 'interviewer@example.com',
};

function withGuests(values, run) {
  const keys = ['RECRUIT_GOOGLE_EXTRA_GUESTS', 'RECRUIT_GOOGLE_SALES_EXTRA_GUESTS', 'RECRUIT_GOOGLE_INVITE_CANDIDATE'];
  const had = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const k of keys) {
      if (had[k] === undefined) delete process.env[k];
      else process.env[k] = had[k];
    }
  }
}

test('with no role guests the invite is exactly what it always was', () => {
  withGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: 'watcher@example.com' }, () => {
    assert.deepEqual(interviewAttendees(PEOPLE), [
      { email: 'candidate@example.com', displayName: 'Cand Idate', responseStatus: 'needsAction' },
      { email: 'interviewer@example.com', displayName: 'Inter Viewer' },
      { email: 'watcher@example.com' },
    ]);
  });
});

test('role guests are added after everyone else, each person once', () => {
  withGuests({ RECRUIT_GOOGLE_EXTRA_GUESTS: 'watcher@example.com' }, () => {
    const attendees = interviewAttendees({
      ...PEOPLE,
      roleGuests: ['sales.lead@example.com', 'watcher@example.com', 'interviewer@example.com'],
    });
    assert.deepEqual(
      attendees.map((a) => a.email),
      ['candidate@example.com', 'interviewer@example.com', 'watcher@example.com', 'sales.lead@example.com'],
    );
  });
});

test('only the Sales role names a guest list of its own', () => {
  assert.equal(extendedRole('sa_sales').calendar.extraGuestsEnv, 'RECRUIT_GOOGLE_SALES_EXTRA_GUESTS');
  assert.equal(extendedRole('india_aidev')?.calendar, undefined);
  // The intern and paralegal roles are not extended roles at all.
  assert.equal(extendedRole('india_intern'), null);
  assert.equal(extendedRole('sa_paralegal'), null);
});

test('the Sales list is read from its own .env key, not the shared one', () => {
  withGuests(
    { RECRUIT_GOOGLE_EXTRA_GUESTS: 'watcher@example.com', RECRUIT_GOOGLE_SALES_EXTRA_GUESTS: ' Sales.Lead@Example.com , bad' },
    () => {
      assert.deepEqual(extraGuests(process.env, 'RECRUIT_GOOGLE_SALES_EXTRA_GUESTS'), ['sales.lead@example.com']);
      assert.deepEqual(extraGuests(process.env), ['watcher@example.com']);
    },
  );
});

test('Meet invites: the Sales guest is added to Sales interviews and to no other role', async () => {
  const { roleGuestsFor } = await import('./meetLink.js');
  withGuests({ RECRUIT_GOOGLE_SALES_EXTRA_GUESTS: 'sales.lead@example.com' }, () => {
    assert.deepEqual(roleGuestsFor('sa_sales'), ['sales.lead@example.com']);
    for (const role of ['india_intern', 'sa_paralegal', 'india_aidev', 'nope', undefined]) {
      assert.deepEqual(roleGuestsFor(role), [], String(role));
    }
  });
  withGuests({}, () => assert.deepEqual(roleGuestsFor('sa_sales'), [], 'unset: Sales adds nobody'));
});
