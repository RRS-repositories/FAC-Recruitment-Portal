import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DECLINE_REASONS,
  NO_REASON,
  declineReason,
  declineSentence,
  isDeclineReason,
} from '../../shared/declineReasons.js';

/**
 * What is worth pinning about a decline reason.
 *
 * Two of these matter more than the rest: no reason must produce no sentence,
 * because an email that invents a reason nobody gave is worse than one that
 * gives none; and an unrecognised code must be refused rather than stored,
 * because a code the dropdown no longer offers is a record nobody can read.
 */

test('no reason produces no sentence', () => {
  assert.equal(declineSentence(NO_REASON), null);
  assert.equal(declineSentence(null), null);
  assert.equal(declineSentence(undefined), null);
});

test('every code the dropdown offers is one the server accepts', () => {
  for (const r of DECLINE_REASONS) {
    assert.ok(isDeclineReason(r.code), `${r.code} should be recognised`);
    assert.ok(r.label, `${r.code} needs a label for the manager`);
  }
});

test('a code that is not offered is refused', () => {
  for (const bad of ['', 'nope', 'AI_USED', 'drop table', null, undefined, 0]) {
    assert.equal(isDeclineReason(bad), false, `${JSON.stringify(bad)} should be refused`);
  }
});

test('every reason except "none" and "other" has wording for the candidate', () => {
  for (const r of DECLINE_REASONS) {
    if (r.code === NO_REASON || r.code === 'other') {
      assert.equal(r.sentence, null, `${r.code} supplies its own or no wording`);
    } else {
      assert.ok(r.sentence && r.sentence.length > 20, `${r.code} needs a sentence a person can read`);
    }
  }
});

test('the manager sees a different string from the candidate', () => {
  // "AI-written answers" is a useful internal shorthand and a poor thing to
  // say to somebody who may not have done it — spec §13.3 warns the signals
  // false-positive on fluent non-native writers.
  const ai = declineReason('ai_used');
  assert.notEqual(ai.label, ai.sentence);
  assert.doesNotMatch(ai.sentence, /ChatGPT|cheated|AI-generated/i);
});

test('"other" uses the manager\'s own words', () => {
  assert.equal(declineSentence('other', 'You withdrew.'), 'You withdrew.');
  assert.equal(declineSentence('other', '   trimmed   '), 'trimmed');
});

test('"other" with nothing written says nothing', () => {
  // Better than an email with an empty paragraph where a reason should be.
  assert.equal(declineSentence('other', ''), null);
  assert.equal(declineSentence('other', '    '), null);
  assert.equal(declineSentence('other', undefined), null);
});

test('a very long note is capped rather than sent whole', () => {
  const long = 'x'.repeat(2000);
  assert.equal(declineSentence('other', long).length, 500);
});

test('a preset reason ignores any note sent alongside it', () => {
  // The wording of a category must not depend on who clicked it, or the same
  // reason reads one way today and another way tomorrow.
  const withNote = declineSentence('role_fit', 'something the manager typed');
  assert.equal(withNote, declineReason('role_fit').sentence);
});
