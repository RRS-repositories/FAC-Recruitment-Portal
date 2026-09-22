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

  // Who else is put on a Sales interview's Meet invite, so they can join
  // without knocking. The addresses are in .env under this name (comma-
  // separated), not here: this repository is public. Sales interviews only.
  calendar: Object.freeze({ extraGuestsEnv: 'RECRUIT_GOOGLE_SALES_EXTRA_GUESTS' }),

  score: (answers) => scoreSales(answers),
  normaliseProfile,
  validateProfile,
  profileForStorage,

  // What the model review (../llmReview.js) is told about the job, so it
  // judges fit for THIS role rather than for a remote paralegal one. Taken
  // from the approved page design ("What the role is" / "What you'll be
  // doing"), not invented. Changing a word here changes what the model is
  // asked: bump promptVersion with it, so reviews stay traceable.
  review: Object.freeze({
    workplace: 'office-based in South Africa, on the phone, UK hours',
    brief: Object.freeze([
      '- Outbound calls to warm leads who have enquired about irresponsible lending, gambling harm or car finance claims.',
      '- Explaining the process in plain English, and signing up the clients we can genuinely help, on the call.',
      '- Inbound customer service: updates, questions, keeping clients informed.',
      '- Logging every call accurately in the CRM.',
      '- A weekly sign-up target, with a bonus for going over it.',
      '- The firm is an SRA-regulated law firm: honesty on every call, no pressure tactics, no promises it cannot keep.',
      '- High call volume (80–120 outbound calls a day), and resilience after rejection.',
      '- UK hours: 9:00–18:00 UK time.',
      'What good looks like: comfortable on the phone, target-driven, honest, resilient, keeps accurate notes.',
    ]),
    promptVersion: 2,
  }),
});
