import test from 'node:test';
import assert from 'node:assert/strict';

import { backoffSeconds, dedupeKey } from './outboxPolicy.js';

/**
 * The queue's own behaviour needs a database and is verified separately. What
 * is worth pinning here is the policy: the retry curve, which is the
 * difference between riding out a mail outage and hammering a dead server, and
 * the dedupe key, which is the only thing standing between a candidate and two
 * copies of the same email.
 */

test('backoff doubles: 1, 2, 4, 8, 16 minutes', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(backoffSeconds),
    [60, 120, 240, 480, 960],
  );
});

test('backoff is capped at 30 minutes', () => {
  // Without a cap the sixth retry would be over an hour away and the tenth
  // would be days — an outage that ended in the morning would still be
  // delaying mail in the afternoon.
  assert.equal(backoffSeconds(5), 1800);
  assert.equal(backoffSeconds(20), 1800);
});

test('the first retry is soon enough to ride out a blip', () => {
  // A dropped connection should not cost a candidate a ten-minute reminder.
  assert.ok(backoffSeconds(0) <= 60);
});

// ── Dedupe keys ─────────────────────────────────────────────────────────────

test('a key is built from its parts, in order', () => {
  assert.equal(dedupeKey('reminder24', 'abc', '2026-09-08T13:00:00.000Z'), 'reminder24:abc:2026-09-08T13:00:00.000Z');
});

test('a Date is written the same way every time', () => {
  // Two calls for the same moment must produce the same key, or the email
  // sends twice.
  const when = new Date('2026-09-08T13:00:00Z');
  assert.equal(dedupeKey('r', 'id', when), dedupeKey('r', 'id', new Date(when.getTime())));
});

test('moving an interview produces a different key', () => {
  // This is what lets a reschedule queue a fresh reminder instead of silently
  // colliding with the one for the old slot.
  const before = dedupeKey('reminder24', 'interview-1', new Date('2026-09-08T13:00:00Z'));
  const after = dedupeKey('reminder24', 'interview-1', new Date('2026-09-09T13:00:00Z'));
  assert.notEqual(before, after);
});

test('empty parts are dropped rather than leaving a gap', () => {
  assert.equal(dedupeKey('ack', null, 'abc', undefined, ''), 'ack:abc');
});

test('an empty key is refused', () => {
  assert.throws(() => dedupeKey(null, undefined, ''), /cannot be empty/);
});

test('an over-long key is refused rather than truncated', () => {
  // Truncation would let two different emails collide, and the second would
  // never be sent at all.
  assert.throws(() => dedupeKey('x'.repeat(250)), /too long/);
});
