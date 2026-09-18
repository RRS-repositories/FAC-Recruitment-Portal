import { AIDEV_QUESTIONS } from './questions.js';
import { maxScoreFor, weightedScore } from '../weightedScore.js';

/**
 * The AI Developer assessment's score, 0-100.
 *
 * The design scores it exactly as the sales role is scored -- the chosen
 * option on a single-choice, the sum of ticks (negatives included) on a
 * multi-select, a maximum built from the best single option and the positive
 * multi options, clamped at zero -- so it uses the one implementation of that
 * rule, ../weightedScore.js, rather than a copy.
 */

export const AIDEV_MAX_SCORE = maxScoreFor(AIDEV_QUESTIONS);

export const scoreAiDev = (answers) => weightedScore(answers, AIDEV_QUESTIONS, AIDEV_MAX_SCORE);
