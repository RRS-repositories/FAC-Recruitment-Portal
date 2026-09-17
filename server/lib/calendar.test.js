import test from 'node:test';
import assert from 'node:assert/strict';

import { GRID, gridBounds, minutesOfDay, rowState } from './calendar.js';

/**
 * The manager's calendar grid, kept apart from the booking hours (17 Sep).
 *
 * Changing the booking hours in Settings must not squeeze the calendar, and an
 * interview booked under older hours must stay visible.
 */

const H = (h, m = 0) => h * 60 + m;

test('the grid is 09:00-18:00 in 30-minute rows by default', () => {
  assert.deepEqual(GRID, { start: H(9), end: H(18), step: 30 });
  assert.deepEqual(gridBounds({ dayStart: H(9), dayEnd: H(18) }), { start: H(9), end: H(18) });
});

test('narrower booking hours do NOT squeeze the grid', () => {
  assert.deepEqual(gridBounds({ dayStart: H(10), dayEnd: H(14) }), { start: H(9), end: H(18) });
});

test('wider booking hours stretch it, to the nearest half hour', () => {
  assert.deepEqual(gridBounds({ dayStart: H(8, 15), dayEnd: H(19, 10) }), { start: H(8), end: H(19, 30) });
});

test('an interview outside the window stretches it so it is never hidden', () => {
  const spans = [{ from: H(18, 30), to: H(19) }, { from: H(7, 45), to: H(8, 15) }];
  assert.deepEqual(gridBounds({ dayStart: H(10), dayEnd: H(14), spans }), { start: H(7, 30), end: H(19) });
});

test('the grid never runs past midnight either side', () => {
  assert.deepEqual(gridBounds({ dayStart: H(0), dayEnd: H(24), spans: [{ from: 0, to: H(24) }] }), { start: 0, end: H(24) });
});

test('interview minutes are read in the interviewer\'s zone, across a clock change', () => {
  // 09:00 London on 1 Oct 2026 is 08:00 UTC (BST); on 1 Nov it is 09:00 UTC (GMT).
  assert.deepEqual(minutesOfDay('2026-10-01T08:00:00Z', '2026-10-01T08:30:00Z', 'Europe/London'), { from: H(9), to: H(9, 30) });
  assert.deepEqual(minutesOfDay('2026-11-01T09:00:00Z', '2026-11-01T09:45:00Z', 'Europe/London'), { from: H(9), to: H(9, 45) });
  // Running past midnight fills to the end of the day rather than wrapping.
  assert.deepEqual(minutesOfDay('2026-10-01T22:30:00Z', '2026-10-01T23:30:00Z', 'Europe/London'), { from: H(23, 30), to: H(24) });
});

const base = {
  working: true, dayStart: H(10), dayEnd: H(14), block: null, interview: null, blackout: null,
  startsAt: new Date('2026-10-01T12:00:00Z'), earliest: new Date('2026-09-01T00:00:00Z'),
};
const at = (minute, over = {}) => rowState({ ...base, minute, ...over });

test('rows inside the booking hours are free, outside are "outside"', () => {
  assert.equal(at(H(10)), 'free');
  assert.equal(at(H(13, 30)), 'free');
  assert.equal(at(H(9, 30)), 'outside');
  assert.equal(at(H(14)), 'outside');
});

test('a row only part-covered by the booking hours is not bookable', () => {
  assert.equal(rowState({ ...base, dayStart: H(10, 15), minute: H(10) }), 'outside');
});

test('an interview is always shown, even outside the current booking hours', () => {
  assert.equal(at(H(16), { interview: { id: 'x' } }), 'booked');
  assert.equal(at(H(9), { interview: { id: 'x' }, working: false }), 'booked');
});

test('the existing order is kept: blocked, then closed, then lunch, then too soon', () => {
  assert.equal(at(H(11), { blackout: { id: 1 } }), 'blocked');
  assert.equal(at(H(11), { working: false }), 'closed');
  assert.equal(at(H(16), { working: false }), 'closed', 'a closed day is closed, not "outside"');
  assert.equal(at(H(11), { block: { label: 'Lunch' } }), 'break');
  assert.equal(at(H(11), { earliest: new Date('2026-12-01T00:00:00Z') }), 'past');
});

test('with today\'s 09:00-18:00 hours nothing is "outside" -- the calendar looks as it did', () => {
  for (let minute = H(9); minute < H(18); minute += 30) {
    assert.notEqual(rowState({ ...base, dayStart: H(9), dayEnd: H(18), minute }), 'outside');
  }
});
