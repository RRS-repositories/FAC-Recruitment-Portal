import test from 'node:test';
import assert from 'node:assert/strict';

import { notifyNoShowFinal, notifyNoShowRebook } from './notify.js';

/**
 * The two emails a "Not attended" press can queue.
 *
 * A fake transaction client records the outbox INSERT, so what is pinned is
 * exactly what would be written: which template, which interview the email is
 * about, what it carries, and the key that stops it being queued twice.
 */

function fakeClient() {
  const inserts = [];
  return {
    inserts,
    query: async (sql, params) => {
      if (/INSERT INTO recruit_outbox/.test(sql)) {
        const [template, toEmail, toName, applicantId, interviewId, vars, sendAfter, dedupeKey, channel] = params;
        inserts.push({ template, toEmail, toName, applicantId, interviewId, vars: JSON.parse(vars), sendAfter, dedupeKey, channel });
      }
      return { rows: [{ id: 'queued-row' }], rowCount: 1 };
    },
  };
}

const applicant = { id: 'app-1', email: 'candidate@example.com', full_name: 'Test Candidate' };

test('the re-book email is about the MISSED interview, and carries the NEW link', async () => {
  // The email names the time they missed. Times resolve from the interview on
  // the row, and the new re-book interview has no time yet -- so the row must
  // point at the missed one, and the new token must travel in vars.
  const client = fakeClient();
  await notifyNoShowRebook(client, { applicant, missedInterviewId: 'missed-1', bookingToken: 'NEW-TOKEN' });

  assert.equal(client.inserts.length, 1);
  const row = client.inserts[0];
  assert.equal(row.template, 'recruit.noshow.rebook');
  assert.equal(row.interviewId, 'missed-1');
  assert.deepEqual(row.vars, { token: 'NEW-TOKEN' });
  assert.equal(row.toEmail, 'candidate@example.com');
  assert.equal(row.channel, 'email');
});

test('one missed interview → one re-book email key, however often it is pressed', async () => {
  const a = fakeClient();
  const b = fakeClient();
  await notifyNoShowRebook(a, { applicant, missedInterviewId: 'missed-1', bookingToken: 'T1' });
  await notifyNoShowRebook(b, { applicant, missedInterviewId: 'missed-1', bookingToken: 'T2' });
  assert.equal(a.inserts[0].dedupeKey, b.inserts[0].dedupeKey, 'a retry must collide on the UNIQUE key');

  const other = fakeClient();
  await notifyNoShowRebook(other, { applicant, missedInterviewId: 'missed-2', bookingToken: 'T3' });
  assert.notEqual(other.inserts[0].dedupeKey, a.inserts[0].dedupeKey, 'a different missed interview is a different email');
});

test('the re-book key does not collide with the existing soft "we missed you" email', async () => {
  // Both can exist for the same interview (the old reissue path, then this).
  // Sharing a key would silently swallow one of them.
  const client = fakeClient();
  await notifyNoShowRebook(client, { applicant, missedInterviewId: 'missed-1', bookingToken: 'T' });
  assert.doesNotMatch(client.inserts[0].dedupeKey, /^noshow:/);
});

test('the final email carries no link, and is the only email queued', async () => {
  const client = fakeClient();
  await notifyNoShowFinal(client, { applicant, interviewId: 'final-1' });

  assert.equal(client.inserts.length, 1, 'exactly one email -- no ordinary decline alongside it');
  const row = client.inserts[0];
  assert.equal(row.template, 'recruit.noshow.final');
  assert.equal(row.interviewId, 'final-1');
  assert.deepEqual(row.vars, {}, 'no booking token: there is nothing left to book');
});

test('re-book and final keys never collide for the same interview', async () => {
  const a = fakeClient();
  const b = fakeClient();
  await notifyNoShowRebook(a, { applicant, missedInterviewId: 'iv-1', bookingToken: 'T' });
  await notifyNoShowFinal(b, { applicant, interviewId: 'iv-1' });
  assert.notEqual(a.inserts[0].dedupeKey, b.inserts[0].dedupeKey);
});
