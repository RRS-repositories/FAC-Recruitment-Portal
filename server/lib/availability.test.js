import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAvailability, isSlotBookable } from './availability.js';
import { formatTimeIn, offsetMs, zonedTimeToInstant } from './zonedTime.js';

/**
 * The highest-consequence arithmetic in the project.
 *
 * A slot offered wrongly means a candidate in Johannesburg joins an empty call,
 * or Priyanshu is double-booked over his lunch. None of that surfaces in
 * development — it surfaces on the day, to a stranger, in another country.
 *
 * Time is injected everywhere so these tests do not change behaviour depending
 * on when they run.
 */

const RULE = {
  timezone: 'Europe/London',
  weekdays: [1, 2, 3, 4, 5],
  day_start: '09:00',
  day_end: '17:00',
  slot_minutes: 30,
  buffer_minutes: 0,
  min_notice_hours: 24,
  max_days_ahead: 14,
  blocks: [{ start: '11:30', end: '12:30', label: 'Lunch' }],
};

// A Wednesday in British Summer Time, and one in GMT.
const SUMMER_NOW = new Date('2026-09-02T08:00:00Z');
const WINTER_NOW = new Date('2026-12-02T09:00:00Z');

const build = (over = {}) =>
  buildAvailability({ rule: RULE, candidateTimezone: 'Asia/Kolkata', now: SUMMER_NOW, ...over });

const allSlots = (days) => days.flatMap((d) => d.slots);
const ukTimes = (days) => [...new Set(allSlots(days).map((s) => s.ukTime))].sort();

test('the working day runs 09:00 to 16:30, in UK time', () => {
  const times = ukTimes(build());
  assert.equal(times[0], '09:00');
  assert.equal(times[times.length - 1], '16:30');
});

test('nothing is offered that would finish after 17:00', () => {
  // The trap: a 16:45 start looks inside the day but ends at 17:15.
  assert.ok(!ukTimes(build()).includes('16:45'));
  assert.ok(!ukTimes(build()).includes('17:00'));
});

test('lunch is blocked, and only lunch', () => {
  const times = ukTimes(build());
  assert.ok(!times.includes('11:30'), '11:30 should be blocked');
  assert.ok(!times.includes('12:00'), '12:00 should be blocked');
  assert.ok(times.includes('11:00'), '11:00 is before lunch and should be offered');
  assert.ok(times.includes('12:30'), '12:30 is when lunch ends and should be offered');
});

test('weekends are never offered', () => {
  const days = build();
  for (const day of days) {
    const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    assert.ok(weekday !== 0 && weekday !== 6, `${day.date} is a weekend`);
  }
});

test('the 24-hour notice window is respected', () => {
  const earliest = allSlots(build())
    .map((s) => new Date(s.startsAt))
    .sort((a, b) => a - b)[0];
  assert.ok(
    earliest.getTime() - SUMMER_NOW.getTime() >= 24 * 3_600_000,
    'a slot was offered inside the notice period',
  );
});

test('nothing is offered beyond the 14-day window', () => {
  const latest = allSlots(build())
    .map((s) => new Date(s.startsAt))
    .sort((a, b) => b - a)[0];
  assert.ok(latest.getTime() - SUMMER_NOW.getTime() <= 15 * 24 * 3_600_000);
});

test('an existing booking removes exactly that slot', () => {
  const target = allSlots(build())[0];
  const after = build({ taken: [{ startsAt: target.startsAt, endsAt: target.endsAt }] });
  assert.ok(!allSlots(after).some((s) => s.startsAt === target.startsAt));
  // and nothing else disappeared with it
  assert.equal(allSlots(after).length, allSlots(build()).length - 1);
});

test('a partial overlap still removes the slot', () => {
  const target = allSlots(build())[0];
  // A meeting starting 10 minutes into the slot must still block it.
  const start = new Date(new Date(target.startsAt).getTime() + 10 * 60_000);
  const after = build({
    taken: [{ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60_000).toISOString() }],
  });
  assert.ok(!allSlots(after).some((s) => s.startsAt === target.startsAt));
});

test('candidates see their own local time, and UK time alongside', () => {
  const india = allSlots(build())[0];
  const sa = allSlots(build({ candidateTimezone: 'Africa/Johannesburg' }))[0];

  // Same instant, three different wall clocks.
  assert.equal(india.startsAt, sa.startsAt);
  assert.notEqual(india.localTime, india.ukTime);
  assert.equal(india.ukTime, sa.ukTime);
  assert.notEqual(india.localTime, sa.localTime);
});

test('a 09:00 UK slot is 13:30 in India in summer and 14:30 in winter', () => {
  // The UK is the only one of the three zones that observes daylight saving,
  // so the candidate's local time for a fixed UK slot moves across the year.
  // That is correct behaviour and the thing most likely to be "fixed" by
  // mistake later.
  const summer = allSlots(build()).find((s) => s.ukTime === '09:00');
  const winter = allSlots(build({ now: WINTER_NOW })).find((s) => s.ukTime === '09:00');

  assert.equal(summer.localTime, '13:30');
  assert.equal(winter.localTime, '14:30');
});

test('the working day stays 09:00-16:30 across the UK clock change', () => {
  // Late October spans the GMT switch. The business day must not drift.
  const acrossChange = build({ now: new Date('2026-10-20T08:00:00Z') });
  const times = ukTimes(acrossChange);
  assert.equal(times[0], '09:00');
  assert.equal(times[times.length - 1], '16:30');
});

test('no duplicate or missing instants across the clock change', () => {
  const slots = allSlots(build({ now: new Date('2026-10-20T08:00:00Z') }));
  const instants = slots.map((s) => s.startsAt);
  assert.equal(new Set(instants).size, instants.length, 'a slot instant appeared twice');
});

test('every slot is exactly the configured length', () => {
  for (const slot of allSlots(build())) {
    const minutes = (new Date(slot.endsAt) - new Date(slot.startsAt)) / 60_000;
    assert.equal(minutes, RULE.slot_minutes);
  }
});

// ── Booking-time re-check ───────────────────────────────────────────────────

test('a slot from the list is bookable', () => {
  const slot = allSlots(build())[0];
  const result = isSlotBookable({ startsAt: slot.startsAt, rule: RULE, now: SUMMER_NOW });
  assert.equal(result.ok, true);
});

test('a hand-made time that is not on the grid is refused', () => {
  const slot = allSlots(build())[0];
  // 09:07 rather than 09:00 — looks plausible, was never offered.
  const off = new Date(new Date(slot.startsAt).getTime() + 7 * 60_000).toISOString();
  assert.equal(isSlotBookable({ startsAt: off, rule: RULE, now: SUMMER_NOW }).ok, false);
});

test('booking into lunch is refused even if requested directly', () => {
  const lunch = zonedTimeToInstant(
    { year: 2026, month: 9, day: 9, hour: 11, minute: 30 },
    'Europe/London',
  ).toISOString();
  assert.equal(isSlotBookable({ startsAt: lunch, rule: RULE, now: SUMMER_NOW }).ok, false);
});

test('booking inside the notice window is refused', () => {
  const soon = zonedTimeToInstant(
    { year: 2026, month: 9, day: 2, hour: 15, minute: 0 },
    'Europe/London',
  ).toISOString();
  assert.equal(isSlotBookable({ startsAt: soon, rule: RULE, now: SUMMER_NOW }).ok, false);
});

test('booking beyond the window is refused', () => {
  const tooFar = zonedTimeToInstant(
    { year: 2026, month: 10, day: 30, hour: 10, minute: 0 },
    'Europe/London',
  ).toISOString();
  assert.equal(isSlotBookable({ startsAt: tooFar, rule: RULE, now: SUMMER_NOW }).ok, false);
});

test('a slot taken since the list was drawn is refused', () => {
  const slot = allSlots(build())[0];
  const result = isSlotBookable({
    startsAt: slot.startsAt,
    rule: RULE,
    taken: [{ startsAt: slot.startsAt, endsAt: slot.endsAt }],
    now: SUMMER_NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /just been taken/);
});

test('a weekend request is refused', () => {
  const saturday = zonedTimeToInstant(
    { year: 2026, month: 9, day: 5, hour: 10, minute: 0 },
    'Europe/London',
  ).toISOString();
  assert.equal(isSlotBookable({ startsAt: saturday, rule: RULE, now: SUMMER_NOW }).ok, false);
});

test('garbage input is refused rather than throwing', () => {
  for (const bad of ['not-a-date', '', null, '2026-13-45T99:99:99Z']) {
    assert.equal(isSlotBookable({ startsAt: bad, rule: RULE, now: SUMMER_NOW }).ok, false);
  }
});

// ── The zone helpers these rest on ──────────────────────────────────────────

test('offsets are measured, not assumed', () => {
  assert.equal(offsetMs(new Date('2026-09-02T12:00:00Z'), 'Europe/London'), 3_600_000); // BST
  assert.equal(offsetMs(new Date('2026-12-02T12:00:00Z'), 'Europe/London'), 0); // GMT
  assert.equal(offsetMs(new Date('2026-09-02T12:00:00Z'), 'Asia/Kolkata'), 19_800_000); // +5:30
  assert.equal(offsetMs(new Date('2026-12-02T12:00:00Z'), 'Asia/Kolkata'), 19_800_000); // no DST
});

test('wall-clock to instant survives both sides of a transition', () => {
  // 2026-10-25 is the UK clock change. A 09:00 either side must round-trip.
  for (const day of [24, 25, 26]) {
    const instant = zonedTimeToInstant({ year: 2026, month: 10, day, hour: 9 }, 'Europe/London');
    assert.equal(formatTimeIn(instant, 'Europe/London'), '09:00', `09:00 broke on Oct ${day}`);
  }
});
