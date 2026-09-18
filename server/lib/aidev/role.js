import { AIDEV_LIMITS, AIDEV_ROLE_KEY } from './limits.js';
import { AIDEV_DETAIL_OPTIONS, AIDEV_QUESTIONS, AIDEV_WRITTEN_QUESTIONS } from './questions.js';
import { scoreAiDev } from './scoring.js';
import { normaliseProfile, profileForStorage, validateProfile } from './profile.js';

/**
 * The AI Developer (India, remote) role, as the extended-role registry
 * (../extendedRoles.js) sees it.
 *
 * Everything particular to the role is in this folder: the questions and
 * their weights (./questions.js), the details step (./profile.js) and the
 * score (./scoring.js, the shared negative-weight rule). No voice note: the
 * CV is the only file.
 */
export const AIDEV_ROLE = Object.freeze({
  apiKey: AIDEV_ROLE_KEY,
  slug: 'ai-developer',
  title: 'AI Developer',
  country: 'India',
  timezone: 'Asia/Kolkata',

  writtenQuestions: AIDEV_WRITTEN_QUESTIONS,
  questions: AIDEV_QUESTIONS,
  detailOptions: AIDEV_DETAIL_OPTIONS,

  limits: AIDEV_LIMITS,
  publicLimits: Object.freeze({ cvMaxBytes: AIDEV_LIMITS.cvMaxBytes }),

  hasVoice: false,
  score: scoreAiDev,
  normaliseProfile,
  validateProfile,
  profileForStorage,
});
