import test from 'node:test';
import assert from 'node:assert/strict';

import { AIDEV_QUESTIONS } from './questions.js';
import { AIDEV_MAX_SCORE, scoreAiDev } from './scoring.js';
import { maxScoreFor } from '../weightedScore.js';
import { validateAnswers } from '../validate.js';

/**
 * The AI Developer assessment's score: the shared negative-weight rule
 * (../weightedScore.js) applied to this role's twelve questions.
 */

const ALL_Q8 = [0, 1, 2, 3, 4, 5, 6, 7];
const BEST = {
  q1: 0, q2: 0, q3: [0, 1, 3], q4: 0, q5: 0, q6: 0,
  q7: 0, q8: ALL_Q8, q9: 0, q10: 0, q11: 0, q12: 0,
};

test('twelve questions, q1..q12, with q3 and q8 the multi-selects', () => {
  assert.deepEqual(AIDEV_QUESTIONS.map((q) => q.id), Array.from({ length: 12 }, (_, i) => `q${i + 1}`));
  assert.deepEqual(AIDEV_QUESTIONS.filter((q) => q.multi).map((q) => q.id), ['q3', 'q8']);
});

test('the maximum: ten single-choice bests of 3, q3 positives 3, q8 positives 8', () => {
  assert.equal(AIDEV_MAX_SCORE, 10 * 3 + 3 + 8);
  assert.equal(maxScoreFor(AIDEV_QUESTIONS), 41);
});

test('the best answers score 100, and are answers the validator accepts', () => {
  assert.deepEqual(validateAnswers(BEST, AIDEV_QUESTIONS), {});
  assert.equal(scoreAiDev(BEST), 100);
});

test('q8 has no negative option: ticking everything there is the best answer', () => {
  const q8 = AIDEV_QUESTIONS.find((q) => q.id === 'q8');
  assert.ok(q8.options.every((o) => o.score > 0));
  // Each tick is worth one of the 41.
  assert.equal(scoreAiDev({ ...BEST, q8: [0] }), Math.round((34 / 41) * 100));
});

test('ticking a negative option on q3 costs points', () => {
  const withBadTick = { ...BEST, q3: [0, 1, 2, 3] }; // + "no review" (-2)
  assert.equal(scoreAiDev(withBadTick), Math.round((39 / 41) * 100));
  const everything = { ...BEST, q3: [0, 1, 2, 3, 4] }; // 3 - 4 = -1
  assert.ok(scoreAiDev(everything) < scoreAiDev(BEST));
  assert.equal(scoreAiDev(everything), Math.round((37 / 41) * 100));
});

test('a score below zero is clamped to 0, never negative', () => {
  assert.equal(scoreAiDev({ q3: [2, 4] }), 0); // -4, nothing else answered
  const allZero = {
    q1: 1, q2: 2, q3: [2, 4], q4: 2, q5: 3, q6: 2,
    q7: 3, q8: [], q9: 1, q10: 2, q11: 1, q12: 1,
  };
  assert.equal(scoreAiDev(allZero), 0);
});

test('the result is always an integer between 0 and 100', () => {
  for (const answers of [BEST, {}, null, undefined, { q1: 3 }, { q3: [0] }, { q8: [7] }]) {
    const score = scoreAiDev(answers);
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `${JSON.stringify(answers)} → ${score}`);
  }
});

test('indexes that do not exist score nothing rather than throwing', () => {
  assert.equal(scoreAiDev({ q1: 99, q3: [99, -1, 'x'], q8: 'not an array' }), 0);
});

test('the design\'s own weights, option by option', () => {
  // [question, weights] as the design lists them. Pinned so a later edit to
  // the rubric is a visible, deliberate change.
  assert.deepEqual(
    AIDEV_QUESTIONS.map((q) => [q.id, q.options.map((o) => o.score)]),
    [
      ['q1', [3, 0, 0, 1]],
      ['q2', [3, 1, 0, 0]],
      ['q3', [1, 1, -2, 1, -2]],
      ['q4', [3, 1, 0, 0]],
      ['q5', [3, 1, 1, 0]],
      ['q6', [3, 1, 0, 0]],
      ['q7', [3, 1, 1, 0]],
      ['q8', [1, 1, 1, 1, 1, 1, 1, 1]],
      ['q9', [3, 0, 0, 1]],
      ['q10', [3, 1, 0, 1]],
      ['q11', [3, 0, 1, 1]],
      ['q12', [3, 0, 1, 0]],
    ],
  );
});
