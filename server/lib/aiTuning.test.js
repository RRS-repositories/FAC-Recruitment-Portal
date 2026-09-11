import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TUNING, detectAiUse, readTuning } from '../../shared/aiDetect.js';

/**
 * What is worth pinning about tunable AI-use detection.
 *
 * The first test is the one that matters most on the day this ships: the rows
 * sitting in `recruit_settings` today hold exactly the numbers the detector
 * was already compiled with, so wiring them up must score every application
 * identically. If that ever stops being true it is a change to how 280-odd
 * live applicants are labelled, and it should be a deliberate one.
 *
 * The rest are about a bad edit. Nobody editing these rows has a form to stop
 * them, so a typo has to degrade to the default for that one field rather
 * than switch detection off across the board.
 */

/** Exactly what `SELECT key, value FROM recruit_settings WHERE key LIKE 'ai_use.%'` returns today. */
const SEEDED_ROWS = [
  { key: 'ai_use.thresholds', value: { ai_used: 60, possible: 30 } },
  {
    key: 'ai_use.weights',
    value: { paste: 45, phrases: 30, em_dashes: 10, fast_written: 25, tab_switches: 15, typing_speed: 30 },
  },
  {
    key: 'ai_use.limits',
    value: {
      paste_chars: 80,
      em_dash_floor: 3,
      chars_per_second: 9,
      tab_switch_floor: 4,
      written_chars_floor: 300,
      written_seconds_floor: 60,
    },
  },
  {
    key: 'ai_use.phrases',
    value: [...DEFAULT_TUNING.phrases],
  },
];

/** A submission that trips paste and tab switches — 45 + 15 = 60, the `ai_used` line. */
const BORDERLINE = {
  written: { w1: 'A perfectly ordinary answer with nothing notable in it.' },
  telemetry: { pasteChars: 400, tabSwitches: 6 },
};

test('the rows in production today score exactly as the constants did', () => {
  const tuned = readTuning(SEEDED_ROWS);
  assert.deepEqual(tuned.weights, DEFAULT_TUNING.weights);
  assert.deepEqual(tuned.limits, DEFAULT_TUNING.limits);
  assert.deepEqual(tuned.thresholds, DEFAULT_TUNING.thresholds);
  assert.deepEqual(tuned.phrases, [...DEFAULT_TUNING.phrases]);

  assert.deepEqual(
    detectAiUse(BORDERLINE.written, BORDERLINE.telemetry, tuned),
    detectAiUse(BORDERLINE.written, BORDERLINE.telemetry),
  );
});

test('no rows at all is the same as the built-in defaults', () => {
  assert.deepEqual(readTuning([]), readTuning(SEEDED_ROWS));
  assert.deepEqual(readTuning(), readTuning(SEEDED_ROWS));
});

test('raising the cutoff moves an application off the flag', () => {
  // The retune actually under discussion: 60 -> 75 takes the paste-plus-tab
  // -switch pattern, which is most of what is flagged today, out of "AI used".
  const before = detectAiUse(BORDERLINE.written, BORDERLINE.telemetry);
  assert.equal(before.level, 'ai_used');
  assert.equal(before.score, 60);

  const raised = readTuning([{ key: 'ai_use.thresholds', value: { ai_used: 75, possible: 30 } }]);
  const after = detectAiUse(BORDERLINE.written, BORDERLINE.telemetry, raised);
  assert.equal(after.level, 'possible');
  assert.equal(after.score, 60, 'the score is unchanged; only where the line sits moved');
});

test('lowering a weight changes the score, not the reasons', () => {
  const lighter = readTuning([{ key: 'ai_use.weights', value: { tab_switches: 5 } }]);
  const after = detectAiUse(BORDERLINE.written, BORDERLINE.telemetry, lighter);

  assert.equal(after.score, 50);
  assert.equal(after.level, 'possible');
  // A manager still sees everything that was noticed. Weighting decides how
  // loudly it is said, never whether it is said at all.
  assert.deepEqual(after.reasons, detectAiUse(BORDERLINE.written, BORDERLINE.telemetry).reasons);
});

test('one unusable value falls back alone, leaving its neighbours tuned', () => {
  const tuned = readTuning([
    { key: 'ai_use.weights', value: { paste: 'lots', tab_switches: 5 } },
  ]);

  assert.equal(tuned.weights.paste, DEFAULT_TUNING.weights.paste, 'the bad one reverts');
  assert.equal(tuned.weights.tab_switches, undefined, 'stored keys are not copied through raw');
  assert.equal(tuned.weights.tabSwitches, 5, 'the good one alongside it still applies');
});

test('a value outside 0-100 is refused rather than clamped', () => {
  // Clamping would silently turn "-1" into 0, which reads as a deliberate
  // decision to switch a signal off. Keeping the default says nothing was set.
  for (const bad of [-1, 101, Infinity, NaN, null]) {
    const tuned = readTuning([{ key: 'ai_use.weights', value: { paste: bad } }]);
    assert.equal(tuned.weights.paste, DEFAULT_TUNING.weights.paste, `${bad} should be refused`);
  }
});

test('an inverted threshold pair is refused as a pair', () => {
  // possible > ai_used would make a score both "possible" and "ai_used" at
  // once. Taking only the valid half would leave a tuning nobody asked for.
  const tuned = readTuning([{ key: 'ai_use.thresholds', value: { ai_used: 20, possible: 80 } }]);
  assert.deepEqual(tuned.thresholds, DEFAULT_TUNING.thresholds);
});

test('a malformed row keeps every other row', () => {
  const tuned = readTuning([
    { key: 'ai_use.weights', value: 'not an object' },
    { key: 'ai_use.thresholds', value: { ai_used: 75, possible: 40 } },
  ]);

  assert.deepEqual(tuned.weights, DEFAULT_TUNING.weights);
  assert.deepEqual(tuned.thresholds, { possible: 40, aiUsed: 75 });
});

test('an empty phrase list switches phrase matching off, and is obeyed', () => {
  const off = readTuning([{ key: 'ai_use.phrases', value: [] }]);
  assert.deepEqual(off.phrases, []);

  const wordy = { w1: 'Furthermore, I am confident that it is worth noting my holistic approach.' };
  assert.equal(detectAiUse(wordy, {}).score > 0, true);
  assert.equal(detectAiUse(wordy, {}, off).score, 0);
});

test('a phrase list that is not a list keeps the built-in one', () => {
  for (const bad of ['delve', { 0: 'delve' }, null, 7]) {
    assert.deepEqual(readTuning([{ key: 'ai_use.phrases', value: bad }]).phrases, [
      ...DEFAULT_TUNING.phrases,
    ]);
  }
});

test('phrases are trimmed, lowercased, and the junk in the list dropped', () => {
  const tuned = readTuning([
    { key: 'ai_use.phrases', value: ['  DELVE  ', '', '   ', 42, null, 'Leverage My'] },
  ]);
  assert.deepEqual(tuned.phrases, ['delve', 'leverage my']);
});

test('a pathological phrase list is capped rather than scanned whole', () => {
  const tuned = readTuning([
    { key: 'ai_use.phrases', value: Array.from({ length: 5000 }, (_, i) => `phrase ${i}`) },
  ]);
  assert.equal(tuned.phrases.length, 200);
});

test('an unrecognised key in a row is ignored, not carried into the tuning', () => {
  const tuned = readTuning([{ key: 'ai_use.limits', value: { paste_chars: 200, nonsense: 5 } }]);
  assert.equal(tuned.limits.pasteChars, 200);
  assert.equal('nonsense' in tuned.limits, false);
});

test('rows for anything else are ignored', () => {
  const tuned = readTuning([
    { key: 'flags.recruitment_portal', value: true },
    { key: 'retention.months', value: 12 },
  ]);
  assert.deepEqual(tuned, readTuning([]));
});

test('the defaults cannot be edited through a returned tuning', () => {
  // readTuning hands back fresh objects; a caller mutating one must not change
  // what the next caller gets.
  const tuned = readTuning([]);
  tuned.weights.paste = 999;
  tuned.phrases.push('mutated');

  assert.equal(readTuning([]).weights.paste, DEFAULT_TUNING.weights.paste);
  assert.equal(readTuning([]).phrases.includes('mutated'), false);
});
