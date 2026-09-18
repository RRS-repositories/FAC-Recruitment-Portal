import { SALES_QUESTIONS } from './questions.js';
import { maxScoreFor, weightedScore } from '../weightedScore.js';

/**
 * The sales assessment's score, 0-100.
 *
 * NOT shared/scoring.js, deliberately: the sales questions carry negative
 * weights, and the rule for those -- single-choice best to the maximum, only
 * the positive multi-select options to the maximum, clamped to 0..100 -- lives
 * in ../weightedScore.js, which the AI Developer role uses too. See there for
 * why applying the paralegal rule to these would be wrong.
 *
 * Scored here, on the server, from weights the browser never received -- the
 * client's own number, if it shows one, is never used.
 */

export { maxScoreFor };

export const SALES_MAX_SCORE = maxScoreFor(SALES_QUESTIONS);

export function scoreSales(answers, questions = SALES_QUESTIONS) {
  const max = questions === SALES_QUESTIONS ? SALES_MAX_SCORE : maxScoreFor(questions);
  return weightedScore(answers, questions, max);
}
