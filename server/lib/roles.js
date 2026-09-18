import {
  publicQuestionsFor,
  questionsFor,
  writtenQuestionsFor,
  WRITTEN_QUESTIONS,
} from './questions.js';
import { SALES_DETAIL_OPTIONS } from './sales/questions.js';
import { SALES_LIMITS, SALES_ROLE_KEY } from './sales/limits.js';

/**
 * Role metadata the server needs.
 *
 * Only the facts that affect behaviour live here — the key, the candidate's
 * timezone, the display title. The marketing copy stays in the client, because
 * it is public text that changes for design reasons, not logic.
 */
const ROLES = {
  india_intern: {
    apiKey: 'india_intern',
    slug: 'intern',
    title: 'Paralegal Internship',
    country: 'India',
    timezone: 'Asia/Kolkata',
  },
  sa_paralegal: {
    apiKey: 'sa_paralegal',
    slug: 'paralegal',
    title: 'Paralegal — Full-time',
    country: 'South Africa',
    timezone: 'Africa/Johannesburg',
  },
  // Everything particular to this role -- its questions, scoring, details and
  // voice note -- lives in ./sales/. Only the facts every role has are here.
  [SALES_ROLE_KEY]: {
    apiKey: SALES_ROLE_KEY,
    slug: 'sales',
    title: 'Sales & Customer Service',
    country: 'South Africa',
    timezone: 'Africa/Johannesburg',
  },
};

/**
  * URL slug to the enum value the database stores.
  *
  * Two names for one role on purpose. The slug is public and answers to
  * marketing — it changed once already, from `india` to `intern`. The enum is
  * in a column on every application ever submitted and must not move because
  * somebody preferred a different link.
  */
export const SLUG_TO_API_KEY = {
  intern: 'india_intern',
  paralegal: 'sa_paralegal',
  sales: SALES_ROLE_KEY,
};

export const ROLE_BY_API_KEY = ROLES;

export function roleBySlug(slug) {
  const apiKey = SLUG_TO_API_KEY[slug];
  return apiKey ? ROLES[apiKey] : null;
}

/** Everything the application form needs — and nothing it should not have. */
export function publicRolePayload(slug) {
  const role = roleBySlug(slug);
  if (!role) return null;

  const payload = {
    slug: role.slug,
    title: role.title,
    country: role.country,
    timezone: role.timezone,
    writtenQuestions: writtenQuestionsFor(role.apiKey),
    // Weights stripped — see questions.js for why that matters.
    questions: publicQuestionsFor(role.apiKey),
  };

  // Sales only: the intern and paralegal payloads carry no new keys, so the
  // form they are served by sees exactly what it saw before this role existed.
  if (role.apiKey === SALES_ROLE_KEY) {
    // The form enforces these for a better experience -- telling someone their
    // recording is too long before they wait for it to upload -- and the
    // server enforces them again, because the form is not a trust boundary.
    payload.limits = {
      cvMaxBytes: SALES_LIMITS.cvMaxBytes,
      voiceMaxBytes: SALES_LIMITS.voiceMaxBytes,
      voiceMaxSeconds: SALES_LIMITS.voiceMaxSeconds,
      voiceMinSeconds: SALES_LIMITS.voiceMinSeconds,
    };
    // Sent rather than duplicated in the client, so the dropdowns and the
    // server's list of accepted values cannot drift apart.
    payload.detailOptions = SALES_DETAIL_OPTIONS;
  }

  return payload;
}

export { questionsFor, writtenQuestionsFor, WRITTEN_QUESTIONS };
