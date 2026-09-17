import test from 'node:test';
import assert from 'node:assert/strict';

import { NOT_SENT_MESSAGE, RETRY_DELAYS_MS, noResponse, sendWithRetry } from './submitRetry.js';

/** A send that fails with the given statuses in turn, then succeeds. */
function scripted(statuses) {
  let calls = 0;
  const send = async () => {
    const status = statuses[calls];
    calls += 1;
    if (status === undefined) return { ok: true, id: 'app-1' };
    const error = new Error(`status ${status}`);
    error.status = status;
    throw error;
  };
  return { send, calls: () => calls };
}

const instant = { wait: async () => {} };

test('a first-time success is sent once, as before', async () => {
  const s = scripted([]);
  assert.deepEqual(await sendWithRetry(s.send, { canRetry: true, ...instant }), { ok: true, id: 'app-1' });
  assert.equal(s.calls(), 1);
});

test('no response, then success: the application goes through', async () => {
  const s = scripted([0]);
  assert.equal((await sendWithRetry(s.send, { canRetry: true, ...instant })).id, 'app-1');
  assert.equal(s.calls(), 2);
});

test('gives up after two retries, with the original no-response error', async () => {
  const s = scripted([0, 0, 0, 0]);
  await assert.rejects(sendWithRetry(s.send, { canRetry: true, ...instant }), (e) => e.status === 0);
  assert.equal(s.calls(), 1 + RETRY_DELAYS_MS.length);
});

test('any answer from the server is never retried', async () => {
  for (const status of [400, 409, 413, 429, 500, 502, 503]) {
    const s = scripted([status]);
    await assert.rejects(sendWithRetry(s.send, { canRetry: true, ...instant }), (e) => e.status === status);
    assert.equal(s.calls(), 1, `status ${status} sent once`);
  }
});

test('without a session, nothing is retried (the server could not recognise a resend)', async () => {
  const s = scripted([0]);
  await assert.rejects(sendWithRetry(s.send, { canRetry: false, ...instant }), (e) => e.status === 0);
  assert.equal(s.calls(), 1);
});

test('waits between attempts, in order', async () => {
  const waited = [];
  const s = scripted([0, 0]);
  await sendWithRetry(s.send, { canRetry: true, wait: async (ms) => waited.push(ms) });
  assert.deepEqual(waited, RETRY_DELAYS_MS);
});

test('only status 0 counts as no response', () => {
  assert.equal(noResponse({ status: 0 }), true);
  assert.equal(noResponse({ status: 429 }), false);
  assert.equal(noResponse(new Error('no status')), false);
  assert.equal(noResponse(null), false);
});

test('the message tells them what to do, not that our servers are down', () => {
  assert.match(NOT_SENT_MESSAGE, /answers are still here/);
  assert.match(NOT_SENT_MESSAGE, /choose your CV again/);
  assert.doesNotMatch(NOT_SENT_MESSAGE, /our servers/);
});
