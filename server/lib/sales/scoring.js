import { SALES_QUESTIONS } from './questions.js';

/**
 * The sales assessment's score, 0-100.
 *
 * NOT shared/scoring.js, deliberately. That rule raises the ceiling for every
 * extra tick on a multi-select, because the paralegal questions have no
 * negative options and needed another way to stop "tick everything" winning.
 * The sales questions do have them, and the design they were written with
 * scores them this way:
 *
 *   - a single-choice question contributes the chosen option's score, and its
 *     best option to the maximum;
 *   - a multi-select contributes the sum of what was ticked (negatives
 *     included), and the sum of its POSITIVE options to the maximum;
 *   - the total is a percentage of that maximum, rounded, and never below 0.
 *
 * Applying the paralegal rule to these would penalise a candidate twice for
 * the same wrong tick. Scored here, on the server, from weights the browser
 * never received -- the client's own number, if it shows one, is never used.
 */

export function maxScoreFor(questions) {
  return questions.reduce((total, question) => {
    const scores = question.options.map((o) => o.score);
    if (question.multi) return total + scores.filter((s) => s > 0).reduce((a, s) => a + s, 0);
    return total + Math.max(...scores);
  }, 0);
}

export const SALES_MAX_SCORE = maxScoreFor(SALES_QUESTIONS);

export function scoreSales(answers, questions = SALES_QUESTIONS) {
  const max = questions === SALES_QUESTIONS ? SALES_MAX_SCORE : maxScoreFor(questions);
  if (max <= 0) return 0;

  let total = 0;
  for (const question of questions) {
    const answer = answers?.[question.id];
    if (answer === undefined || answer === null) continue;

    // Only indexes that exist count. validateAnswers has already refused
    // anything else by the time the route gets here; this is so the function
    // is safe on its own and cannot be handed a score the questions never
    // offered.
    const picked = question.multi ? (Array.isArray(answer) ? answer : []) : [answer];
    for (const index of picked) {
      const option = Number.isInteger(index) ? question.options[index] : undefined;
      if (option) total += option.score;
    }
  }

  // Clamped both ways: below zero is possible by design (all the wrong
  // ticks), and the column is CHECKed to 0..100.
  return Math.min(100, Math.max(0, Math.round((total / max) * 100)));
}
