import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DNR_REASON,
  PATHS,
  REBOOK_EXPIRY_DAYS,
  SYSTEM_NOSHOW_ACTOR,
  notAttendedDecision,
  notAttendedLabel,
} from './rebookPolicy.js';

/**
 * Who can be marked "Not attended".
 *
 * Being marked a no-show is a thing said about a real person, and the second
 * one ends their application and bars them. So the rules worth pinning are the
 * refusals: every way a press must NOT go through.
 */

const NOW = new Date('2026-09-15T12:00:00Z');
const PAST = '2026-09-15T10:00:00Z';
const FUTURE = '2026-09-15T15:00:00Z';

const accepted = { status: 'accepted', do_not_rehire: false };
const booked = { status: 'booked', starts_at: PAST, is_final_chance: false };

const decide = (over = {}) =>
  notAttendedDecision({ applicant: accepted, interview: booked, offerExists: false, now: NOW, ...over });

/* ── What goes through ───────────────────────────────────────────────────── */

test('a booked interview that has started offers the final re-book', () => {
  assert.deepEqual(decide(), { ok: true, path: PATHS.rebook });
});

test('an interview already marked no-show by hand can still be offered the re-book', () => {
  // The existing attendance button marks without offering anything, so a
  // manager who used it first must still be able to follow through.
  assert.deepEqual(decide({ interview: { ...booked, status: 'no_show' } }), { ok: true, path: PATHS.rebook });
});

test('missing the FINAL chance takes the final path, not another re-book', () => {
  const finalChance = { ...booked, is_final_chance: true };
  assert.deepEqual(decide({ interview: finalChance }), { ok: true, path: PATHS.final });
  assert.deepEqual(decide({ interview: { ...finalChance, status: 'no_show' } }), { ok: true, path: PATHS.final });
});

test('the final path is reached even when a newer link exists', () => {
  // A final-chance interview never gets a re-book of its own; offerExists
  // must not be able to block the decline that missing it leads to.
  assert.equal(decide({ interview: { ...booked, is_final_chance: true }, offerExists: true }).path, PATHS.final);
});

/* ── What must not ───────────────────────────────────────────────────────── */

test('before the start time nobody can be marked', () => {
  const r = decide({ interview: { ...booked, starts_at: FUTURE } });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'not_started');
  assert.equal(r.message, "That interview hasn't started yet.");
});

test('exactly at the start time it is allowed', () => {
  assert.equal(decide({ interview: { ...booked, starts_at: NOW.toISOString() } }).ok, true);
});

test('a second press cannot send a second link (double click, or old reissue)', () => {
  const r = decide({ offerExists: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'offer_exists');
});

test('only an accepted candidate', () => {
  for (const status of ['pending', 'declined']) {
    const r = decide({ applicant: { status, do_not_rehire: false } });
    assert.equal(r.code, 'not_accepted', status);
  }
});

test('someone already barred is refused, and told why', () => {
  // Checked before status, because a barred candidate is also declined and
  // "only an accepted candidate" would hide what actually happened.
  const r = decide({ applicant: { status: 'declined', do_not_rehire: true } });
  assert.equal(r.code, 'do_not_rehire');
});

test('an attended interview is not overwritten', () => {
  const r = decide({ interview: { ...booked, status: 'attended' } });
  assert.equal(r.code, 'attended');
  assert.match(r.message, /correct it first/);
});

test('a cancelled interview has nothing to mark', () => {
  assert.equal(decide({ interview: { ...booked, status: 'cancelled' } }).code, 'cancelled');
});

test('no booked interview at all', () => {
  assert.equal(decide({ interview: null }).code, 'no_interview');
  assert.equal(decide({ interview: { ...booked, starts_at: null } }).code, 'no_interview');
  assert.equal(decide({ interview: { ...booked, starts_at: 'not a date' } }).code, 'no_interview');
});

test('an invited interview (link sent, nothing booked) is not markable', () => {
  assert.equal(decide({ interview: { ...booked, status: 'invited' } }).code, 'wrong_status');
});

test('no applicant', () => {
  assert.equal(decide({ applicant: null }).code, 'not_found');
});

test('only a strict true counts as barred or as a final chance', () => {
  // Rows come from the database, where these are booleans -- but a stray
  // string must never quietly bar somebody or skip their re-book.
  assert.equal(decide({ applicant: { status: 'accepted', do_not_rehire: 'true' } }).ok, true);
  assert.equal(decide({ interview: { ...booked, is_final_chance: 'true' } }).path, PATHS.rebook);
});

test('every refusal carries a message a manager can read', () => {
  const cases = [
    decide({ applicant: null }),
    decide({ applicant: { status: 'accepted', do_not_rehire: true } }),
    decide({ applicant: { status: 'pending', do_not_rehire: false } }),
    decide({ interview: null }),
    decide({ interview: { ...booked, status: 'attended' } }),
    decide({ interview: { ...booked, status: 'cancelled' } }),
    decide({ interview: { ...booked, status: 'invited' } }),
    decide({ interview: { ...booked, starts_at: FUTURE } }),
    decide({ offerExists: true }),
  ];
  for (const r of cases) {
    assert.equal(r.ok, false);
    assert.ok(r.code, 'has a code');
    assert.ok(typeof r.message === 'string' && r.message.length > 10, `${r.code} has a message`);
  }
});

/* ── Labels and constants ────────────────────────────────────────────────── */

test('the button reads differently on a final chance, and is absent when refused', () => {
  assert.equal(notAttendedLabel(decide()), 'Not attended');
  assert.equal(notAttendedLabel(decide({ interview: { ...booked, is_final_chance: true } })), 'Not attended — final');
  assert.equal(notAttendedLabel(decide({ offerExists: true })), null);
  assert.equal(notAttendedLabel(null), null);
});

test('the link lasts 7 days, because the email says 7 days', () => {
  assert.equal(REBOOK_EXPIRY_DAYS, 7);
});

test('the system actor is clearly not a person', () => {
  // It lands in decided_by_email, which is otherwise a manager's address.
  assert.doesNotMatch(SYSTEM_NOSHOW_ACTOR, /@/);
  assert.match(SYSTEM_NOSHOW_ACTOR, /^system:/);
});

test('do-not-rehire reasons fit the database limit', () => {
  // recruit_applicants_dnr_explained caps a reason at 300 characters.
  for (const reason of Object.values(DNR_REASON)) {
    assert.ok(reason.trim().length > 0 && reason.length <= 300, reason);
  }
});
