import { SALES_LIMITS, SALES_ROLE_KEY } from './limits.js';
import { SALES_DETAIL_OPTIONS, SALES_QUESTIONS, SALES_WRITTEN_QUESTIONS } from './questions.js';
import { scoreSales } from './scoring.js';
import { normaliseProfile, profileForStorage, validateProfile } from './profile.js';

/**
 * The Sales & Customer Service (South Africa) role, as the extended-role
 * registry (../extendedRoles.js) sees it: its facts, its questions, its
 * details step and how it is marked.
 *
 * Deliberately NOT the voice note. That code (./voice.js) reaches storage.js,
 * which fixes CV_STORAGE_DIR as it loads, and this file is imported by
 * roles.js -- which half the server imports. `hasVoice` is the flag; the
 * application route takes the voice helpers from ./index.js itself.
 */
export const SALES_ROLE = Object.freeze({
  apiKey: SALES_ROLE_KEY,
  slug: 'sales',
  title: 'Sales & Customer Service',
  country: 'South Africa',
  timezone: 'Africa/Johannesburg',

  writtenQuestions: SALES_WRITTEN_QUESTIONS,
  questions: SALES_QUESTIONS,
  detailOptions: SALES_DETAIL_OPTIONS,

  // What the server enforces.
  limits: SALES_LIMITS,
  // What the form is told. The form enforces these for a better experience --
  // telling someone their recording is too long before they wait for it to
  // upload -- and the server enforces them again, because the form is not a
  // trust boundary.
  publicLimits: Object.freeze({
    cvMaxBytes: SALES_LIMITS.cvMaxBytes,
    voiceMaxBytes: SALES_LIMITS.voiceMaxBytes,
    voiceMaxSeconds: SALES_LIMITS.voiceMaxSeconds,
    voiceMinSeconds: SALES_LIMITS.voiceMinSeconds,
  }),

  hasVoice: true,
  score: (answers) => scoreSales(answers),
  normaliseProfile,
  validateProfile,
  profileForStorage,
});
