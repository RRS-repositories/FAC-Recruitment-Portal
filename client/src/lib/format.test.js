import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDuration } from './format.js';

/**
 * How long a form was open, written for a person to read.
 *
 * The case that prompted this: an applicant who opened the form, went away and
 * submitted the next day printed as "951m 00s". The number was right and the
 * presentation made it read as a fault.
 */

test('under an hour keeps minutes and seconds', () => {
  assert.equal(formatDuration(0), '0m 00s');
  assert.equal(formatDuration(9), '0m 09s');
  assert.equal(formatDuration(65), '1m 05s');
  assert.equal(formatDuration(780), '13m 00s'); // the median applicant
  assert.equal(formatDuration(3599), '59m 59s');
});

test('an hour or more rolls into hours', () => {
  assert.equal(formatDuration(3600), '1h 00m');
  assert.equal(formatDuration(3660), '1h 01m');
  // The longest on record: 951 minutes, which used to print as "951m 00s".
  assert.equal(formatDuration(951 * 60), '15h 51m');
});

test('no duration is a dash, not a zero', () => {
  // 54 applicants have none, because the rate limiter refused to open a
  // session for them. "0m 00s" would claim they submitted instantly.
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(undefined), '—');
  assert.notEqual(formatDuration(null), formatDuration(0));
});

test('nothing renders as a negative or a fraction', () => {
  assert.equal(formatDuration(-5), '0m 00s');
  assert.equal(formatDuration(90.7), '1m 31s');
});
