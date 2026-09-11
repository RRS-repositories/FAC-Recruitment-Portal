import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_LEVELS,
  DEFAULT_TUNING,
  aiLevelLabel,
  detectAiUse,
  levelFor,
  readTuning,
} from '../../shared/aiDetect.js';
import { foldAiOpinion } from './llmReview.js';

/**
 * The rule: "AI used" needs both judges, reaching it by different evidence.
 *
 * The case that forced this is the first test. Behaviour cannot see who wrote
 * something -- it sees that text was pasted, and a candidate drafting in Word
 * leaves the same trace as one copying from ChatGPT. Against the 290 live
 * applications, behaviour alone flagged 100 and the model disagreed with 82,
 * including one where it said the candidate had pasted Latin filler text.
 */

/** Pasted, and left the page. 45 + 15 = 60: the old "AI used" line exactly. */
const PASTED_AND_TABBED = {
  written: { w1: 'lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  telemetry: { pasteChars: 900, tabSwitches: 7 },
};

test('gibberish that was pasted is NOT "AI used" when the model says it is not AI', () => {
  const behaviour = detectAiUse(PASTED_AND_TABBED.written, PASTED_AND_TABBED.telemetry);
  assert.equal(behaviour.score, 60, 'still scores 60 -- the signals are real');
  assert.equal(behaviour.mechanical, true, 'pasting is mechanical corroboration');

  const folded = foldAiOpinion(behaviour, {
    aiOpinion: 'unlikely',
    aiRationale: 'They pasted Latin filler text, not AI output.',
  });

  assert.equal(folded.level, 'possible', 'worth a look, not an accusation');
  assert.notEqual(folded.level, 'ai_used');
});

test('the same behaviour IS "AI used" once the model agrees', () => {
  const behaviour = detectAiUse(PASTED_AND_TABBED.written, PASTED_AND_TABBED.telemetry);
  const folded = foldAiOpinion(behaviour, {
    aiOpinion: 'likely',
    aiRationale: 'Generic, contradicts the CV.',
  });

  assert.equal(folded.level, 'ai_used');
  assert.match(folded.reasons.at(-1), /Model review:/);
});

test('behaviour alone can never reach "AI used", however high it scores', () => {
  // Every signal at once. Under the old rule this was 100 and "AI used" on
  // behaviour alone; nothing about it says who wrote the words.
  const everything = detectAiUse(
    { w1: `${'x'.repeat(400)} furthermore, moreover, — — —` },
    { pasteChars: 5000, typedChars: 5000, activeSecs: 10, writtenSecs: 5, tabSwitches: 40 },
  );
  assert.equal(everything.score, 100);
  assert.equal(everything.level, 'possible');
});

test('the model alone cannot reach it either', () => {
  // What its "likely" mostly detects is generic writing, and generic
  // correlates with inexperience at least as much as with AI.
  const quiet = detectAiUse({ w1: 'A short, ordinary, hand-typed answer.' }, {});
  assert.equal(quiet.mechanical, false);

  const folded = foldAiOpinion(quiet, { aiOpinion: 'likely', aiRationale: 'Very generic.' });
  assert.equal(folded.level, 'possible', 'a reason to look, never a verdict');
});

test('tab switches are not mechanical corroboration', () => {
  // They fire for 62% of applicants. A signal that flags two thirds of
  // everybody cannot tell them apart.
  const tabsOnly = detectAiUse({ w1: 'Ordinary answer.' }, { tabSwitches: 20 });
  assert.equal(tabsOnly.mechanical, false);
  assert.equal(
    foldAiOpinion(tabsOnly, { aiOpinion: 'likely', aiRationale: 'Generic.' }).level,
    'possible',
  );
});

test('the full truth table', () => {
  const cases = [
    // opinion,    mechanical, score, expected
    ['likely', true, 60, 'ai_used'],
    ['likely', true, 25, 'ai_used'], // speed alone corroborates
    ['likely', false, 60, 'possible'],
    ['likely', false, 0, 'possible'],
    ['unlikely', true, 60, 'possible'],
    ['unlikely', true, 0, 'clean'],
    ['unclear', true, 45, 'possible'],
    [null, true, 60, 'possible'], // not yet reviewed
    [null, false, 0, 'clean'],
  ];
  for (const [opinion, mechanical, score, expected] of cases) {
    assert.equal(
      levelFor({ score, mechanical, opinion }, DEFAULT_TUNING.thresholds),
      expected,
      `${opinion} / mechanical=${mechanical} / ${score}`,
    );
  }
});

test('a freshly submitted application is never "AI used" before it is read', () => {
  // The review runs seconds later in its own worker. Claiming the top label
  // before anything has read the words would be a verdict with no evidence.
  for (const level of [detectAiUse(PASTED_AND_TABBED.written, PASTED_AND_TABBED.telemetry).level]) {
    assert.notEqual(level, 'ai_used');
  }
});

test('the fold honours a tuned threshold instead of the old hardcoded 60/30', () => {
  // This is the bug that made ai_use.thresholds appear to work and not.
  const raised = readTuning([{ key: 'ai_use.thresholds', value: { ai_used: 75, possible: 50 } }]);
  const behaviour = detectAiUse({ w1: 'Ordinary.' }, { tabSwitches: 9 }); // 15 points

  assert.equal(foldAiOpinion(behaviour, { aiOpinion: 'unlikely' }, raised).level, 'clean');
  // 15 + 15 = 30, which is below the raised "possible" line of 50 -- but the
  // model said likely, and that alone is always worth a look.
  assert.equal(foldAiOpinion(behaviour, { aiOpinion: 'likely' }, raised).level, 'possible');
});

test('the score is unchanged by any of this', () => {
  // Managers sort by it. The rule changed what the LABEL means, not the number.
  const behaviour = detectAiUse(PASTED_AND_TABBED.written, PASTED_AND_TABBED.telemetry);
  assert.equal(foldAiOpinion(behaviour, { aiOpinion: 'unlikely' }).score, 60);
  assert.equal(foldAiOpinion(behaviour, { aiOpinion: 'likely' }).score, 75);
});

/* ── The column must never be blank ──────────────────────────────────────── */

test('every level the detector can produce has a label', () => {
  for (const level of AI_LEVELS) {
    assert.ok(aiLevelLabel(level), `${level} needs a label`);
    assert.notEqual(aiLevelLabel(level), 'Not checked');
  }
});

test('nothing renders as an empty badge -- not null, not a typo, not a new level', () => {
  // `AI_LEVEL_LABEL[level]` returned undefined for all of these, and React
  // renders undefined as nothing: a blank cell in the column that exists to
  // warn somebody.
  for (const bad of [null, undefined, '', 'ai-used', 'AI_USED', 'unknown', 0, false, {}, []]) {
    const label = aiLevelLabel(bad);
    assert.equal(typeof label, 'string', `${JSON.stringify(bad)} must give a string`);
    assert.ok(label.trim().length > 0, `${JSON.stringify(bad)} must not be blank`);
  }
});

test('an unknown level says so rather than reading as "Clean"', () => {
  // Defaulting to Clean would tell a manager an application had been checked
  // and was fine, when it had not been checked at all.
  assert.equal(aiLevelLabel(null), 'Not checked');
  assert.notEqual(aiLevelLabel(null), aiLevelLabel('clean'));
});
