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

  // What the model review (../llmReview.js) is told about the job. Taken from
  // the approved page design ("What you'd be building" / "What we're looking
  // for"), not invented. Changing a word here changes what the model is
  // asked: bump promptVersion with it, so reviews stay traceable.
  review: Object.freeze({
    workplace: 'fully remote in India, UK hours',
    brief: Object.freeze([
      "- Extending the firm's in-house, AI-driven CRM, its email-processing AI, its WhatsApp document-collection workflows and the AI agents that work inside the CRM.",
      '- Taking a feature from a plain-English brief through design, build, test and deploy, working directly with the UK head of development and using AI coding tools as a normal part of the workflow.',
      "What we're looking for:",
      '- Real experience with CRM systems: the data model, integrations and the messy edges.',
      '- Automations they have built and kept running: n8n, Make, custom code, webhooks, queues.',
      '- Production use of LLM APIs: structured outputs, tool calls, cost and error handling.',
      '- Comfortable on a Linux VPS with Docker, Postgres and Git.',
      "- Honest about what they don't know, and quick to flag problems early.",
    ]),
    promptVersion: 2,
  }),
});
