import test from 'node:test';
import assert from 'node:assert/strict';

import { formatTime, offsetMinutes, INTERVIEW_TZ, CANDIDATE_TZ } from './timezone.js';

/**
 * Interview times are the highest-consequence arithmetic in this project: get
 * them wrong and a candidate in Johannesburg joins an empty call an hour late.
 *
 * These tests pin the decision that availability is anchored to UK time and
 * converted outward. The UK is the only one of the three zones that observes
 * daylight saving, so the same 09:00 rule is a different local time for the
 * candidate in summer and winter — that is correct, and it is exactly the kind
 * of thing that looks like a bug later unless it is written down as a test.
 */

// Instants built from UTC explicitly. BST is UTC+1, GMT is UTC+0, so UK 09:00
// is 08:00Z in September and 09:00Z in December.
const UK_0900_SUMMER = new Date('2026-09-15T08:00:00Z');
const UK_0900_WINTER = new Date('2026-12-15T09:00:00Z');
const UK_1700_SUMMER = new Date('2026-09-15T16:00:00Z');

test('the scheduling anchor is UK time', () => {
  assert.equal(INTERVIEW_TZ, 'Europe/London');
});

test('each role maps to the right candidate timezone', () => {
  assert.equal(CANDIDATE_TZ.india_intern, 'Asia/Kolkata');
  assert.equal(CANDIDATE_TZ.sa_paralegal, 'Africa/Johannesburg');
});

test('a 09:00 UK slot in summer is 13:30 IST and 10:00 SAST', () => {
  assert.equal(formatTime(UK_0900_SUMMER, 'Europe/London'), '09:00');
  assert.equal(formatTime(UK_0900_SUMMER, 'Asia/Kolkata'), '13:30');
  assert.equal(formatTime(UK_0900_SUMMER, 'Africa/Johannesburg'), '10:00');
});

test('the same 09:00 UK slot in winter is 14:30 IST and 11:00 SAST', () => {
  // One hour later for both candidates, because the UK clock moved and theirs
  // did not. The business still sees 09:00.
  assert.equal(formatTime(UK_0900_WINTER, 'Europe/London'), '09:00');
  assert.equal(formatTime(UK_0900_WINTER, 'Asia/Kolkata'), '14:30');
  assert.equal(formatTime(UK_0900_WINTER, 'Africa/Johannesburg'), '11:00');
});

test('the 17:00 UK cutoff lands at a civil hour for both candidate regions', () => {
  // Guards the rule change from an earlier draft: anchoring to the
  // interviewer's own IST day would have offered South African candidates
  // interviews at 05:30 their time.
  assert.equal(formatTime(UK_1700_SUMMER, 'Asia/Kolkata'), '21:30');
  assert.equal(formatTime(UK_1700_SUMMER, 'Africa/Johannesburg'), '18:00');
});

test('only the UK zone shifts with daylight saving', () => {
  assert.equal(offsetMinutes(UK_0900_SUMMER, 'Europe/London'), 60);
  assert.equal(offsetMinutes(UK_0900_WINTER, 'Europe/London'), 0);

  // India and South Africa observe no DST — a fixed offset all year, which is
  // why anchoring to their clocks would have been the simpler-looking but
  // worse choice.
  assert.equal(offsetMinutes(UK_0900_SUMMER, 'Asia/Kolkata'), 330);
  assert.equal(offsetMinutes(UK_0900_WINTER, 'Asia/Kolkata'), 330);
  assert.equal(offsetMinutes(UK_0900_SUMMER, 'Africa/Johannesburg'), 120);
  assert.equal(offsetMinutes(UK_0900_WINTER, 'Africa/Johannesburg'), 120);
});
