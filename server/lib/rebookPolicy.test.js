import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DNR_REASON,
  PATHS,
  REBOOK_EXPIRY_DAYS,
  SYSTEM_NOSHOW_ACTOR,
  SYSTEM_DNR_ACTOR,
  attendanceGuard,
  cancelGuard,
  notAttendedDecision,
  notAttendedLabel,
  reappliedReason,
  reissueGuard,
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

/* ── Phase 4: no other way round the final chance ────────────────────────── */

const finalBooked = { status: 'booked', is_final_chance: true };
const finalInvited = { status: 'invited', is_final_chance: true };
const ordinary = { status: 'booked', is_final_chance: false };

test('the old attendance button cannot record a missed final chance', () => {
  const r = attendanceGuard({ flagOn: true, interview: finalBooked, status: 'no_show' });
  assert.equal(r.code, 'final_use_not_attended');
  assert.match(r.message, /Not attended — final/);
});

test('it can still record a final chance as ATTENDED', () => {
  // Good news is not a way round anything.
  assert.equal(attendanceGuard({ flagOn: true, interview: finalBooked, status: 'attended' }), null);
});

test('it still records ordinary no-shows exactly as before', () => {
  assert.equal(attendanceGuard({ flagOn: true, interview: ordinary, status: 'no_show' }), null);
});

test('reissue cannot extend or rotate a final-chance link, in any state', () => {
  // invited (7 days -> 14 with the wrong email), booked, and cancelled (which
  // would otherwise start a brand-new non-final booking) are all refused.
  for (const latest of [finalInvited, finalBooked, { status: 'cancelled', is_final_chance: true }]) {
    assert.equal(reissueGuard({ flagOn: true, latest }).code, 'final_no_reissue', latest.status);
  }
});

test('reissue on a missed interview points to "Not attended" instead', () => {
  const r = reissueGuard({ flagOn: true, latest: { status: 'no_show', is_final_chance: false } });
  assert.equal(r.code, 'no_show_use_not_attended');
  assert.match(r.message, /Not attended/);
});

test('reissue on an ordinary invited or booked link is unchanged', () => {
  for (const latest of [{ status: 'invited', is_final_chance: false }, ordinary]) {
    assert.equal(reissueGuard({ flagOn: true, latest }), null, latest.status);
  }
  assert.equal(reissueGuard({ flagOn: true, latest: null }), null, 'no interview yet');
});

test('with the switch OFF, no guard applies — every existing button behaves as before', () => {
  assert.equal(attendanceGuard({ flagOn: false, interview: finalBooked, status: 'no_show' }), null);
  for (const latest of [finalInvited, finalBooked, { status: 'no_show', is_final_chance: false }]) {
    assert.equal(reissueGuard({ flagOn: false, latest }), null);
  }
});

test('only a strict true counts as a final chance in the guards too', () => {
  assert.equal(attendanceGuard({ flagOn: true, interview: { status: 'booked', is_final_chance: 'true' }, status: 'no_show' }), null);
  assert.equal(reissueGuard({ flagOn: true, latest: { status: 'invited', is_final_chance: 1 } }), null);
});

/* ── Phase 5: cancelling a final chance, and reapplying while barred ─────── */

test('a candidate cannot cancel their final chance online', () => {
  const r = cancelGuard({ flagOn: true, interview: { status: 'booked', is_final_chance: true } });
  assert.equal(r.code, 'final_no_cancel');
  // Worded for the candidate, and it tells them what they CAN do.
  assert.match(r.message, /can still change the time/);
  assert.match(r.message, /reply to your email/);
  assert.doesNotMatch(r.message, /manager|flag|final_no_cancel/i);
});

test('an ordinary booking can still be cancelled', () => {
  assert.equal(cancelGuard({ flagOn: true, interview: { status: 'booked', is_final_chance: false } }), null);
});

test('with the switch OFF, cancelling works exactly as before', () => {
  assert.equal(cancelGuard({ flagOn: false, interview: { status: 'booked', is_final_chance: true } }), null);
});

test('the automatic decline of a barred address is recorded against the system, not a person', () => {
  assert.doesNotMatch(SYSTEM_DNR_ACTOR, /@/);
  assert.match(SYSTEM_DNR_ACTOR, /^system:/);
  assert.notEqual(SYSTEM_DNR_ACTOR, SYSTEM_NOSHOW_ACTOR, 'the two rules are told apart in the audit trail');
});

test('a reapplication carries the original reason forward, within the database limit', () => {
  assert.equal(reappliedReason('Two interview no-shows'), 'Two interview no-shows');
  assert.equal(reappliedReason('  padded  '), 'padded');
  // The CHECK constraint refuses a blank reason, so there is always one.
  for (const nothing of [null, undefined, '', '   ']) {
    assert.equal(reappliedReason(nothing), 'On the do-not-rehire list');
  }
  assert.equal(reappliedReason('x'.repeat(1000)).length, 300);
});
