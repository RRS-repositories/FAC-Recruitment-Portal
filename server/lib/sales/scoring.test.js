import test from 'node:test';
import assert from 'node:assert/strict';

import { SALES_QUESTIONS } from './questions.js';
import { SALES_MAX_SCORE, maxScoreFor, scoreSales } from './scoring.js';
import { validateAnswers } from '../validate.js';

/**
 * The sales assessment's score. What is worth pinning is the part that
 * differs from shared/scoring.js: negative options on the multi-selects, a
 * maximum built from the positive options only, and a floor at zero.
 */

const BEST = { q1: 0, q2: 1, q3: [0, 1, 3], q4: 0, q5: 0, q6: 1, q7: [0, 1, 3], q8: 0, q9: 0, q10: 0 };

test('ten questions, q1..q10, two of them multi-select', () => {
  assert.deepEqual(
    SALES_QUESTIONS.map((q) => q.id),
    ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
  );
  assert.deepEqual(
    SALES_QUESTIONS.filter((q) => q.multi).map((q) => q.id),
    ['q3', 'q7'],
  );
});

test('the maximum is every single-choice best plus every positive multi option', () => {
  // 8 single-choice questions worth 3, and two multi-selects whose positive
  // options add to 3 each.
  assert.equal(SALES_MAX_SCORE, 8 * 3 + 3 + 3);
  assert.equal(maxScoreFor(SALES_QUESTIONS), 30);
});

test('the best answers score 100, and are answers the validator accepts', () => {
  assert.deepEqual(validateAnswers(BEST, SALES_QUESTIONS), {});
  assert.equal(scoreSales(BEST), 100);
});

test('ticking a negative option on a multi-select costs points', () => {
  const withBadTick = { ...BEST, q3: [0, 1, 2, 3] }; // + "promise a payout" (-2)
  assert.equal(scoreSales(withBadTick), Math.round((28 / 30) * 100));
});

test('ticking everything on a multi-select does not beat ticking the right things', () => {
  const everything = { ...BEST, q3: [0, 1, 2, 3, 4], q7: [0, 1, 2, 3, 4] };
  assert.ok(scoreSales(everything) < scoreSales(BEST));
  // q3: 3 - 4 = -1, q7: 3 - 2 = 1 → 24 + (-1) + 1 = 24 of 30.
  assert.equal(scoreSales(everything), 80);
});

test('a score below zero is clamped to 0, never negative', () => {
  const worst = { q3: [2, 4], q7: [2, 4] }; // -4 and -2, nothing else answered
  assert.equal(scoreSales(worst), 0);

  const allZero = { q1: 1, q2: 0, q3: [2, 4], q4: 1, q5: 1, q6: 0, q7: [2, 4], q8: 2, q9: 2, q10: 1 };
  assert.equal(scoreSales(allZero), 0);
});

test('the result is always an integer between 0 and 100', () => {
  for (const answers of [BEST, {}, null, undefined, { q1: 3 }, { q3: [0] }, { q7: [2] }]) {
    const score = scoreSales(answers);
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `${JSON.stringify(answers)} → ${score}`);
  }
});

test('a single mid answer scores its share of the maximum', () => {
  assert.equal(scoreSales({ q1: 3 }), Math.round((1 / 30) * 100)); // "go straight into the process" = 1
  assert.equal(scoreSales({ q1: 0 }), 10); // 3 / 30
});

test('indexes that do not exist score nothing rather than throwing', () => {
  assert.equal(scoreSales({ q1: 99, q3: [99, -1, 'x'], q7: 'not an array' }), 0);
});
