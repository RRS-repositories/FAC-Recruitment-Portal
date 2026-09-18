import {
  publicQuestionsFor,
  questionsFor,
  writtenQuestionsFor,
  WRITTEN_QUESTIONS,
} from './questions.js';
import { EXTENDED_ROLES, extendedRole } from './extendedRoles.js';

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
  // The extended roles (Sales & Customer Service, AI Developer): everything
  // particular to each -- questions, scoring, details, any voice note -- lives
  // in its own folder, listed by ./extendedRoles.js. Only the facts every role
  // has are copied here, in the same five keys as the two above.
  ...Object.fromEntries(
    EXTENDED_ROLES.map(({ apiKey, slug, title, country, timezone }) => [
      apiKey,
      { apiKey, slug, title, country, timezone },
    ]),
  ),
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
  // `sales` → sa_sales, `ai-developer` → india_aidev.
  ...Object.fromEntries(EXTENDED_ROLES.map(({ slug, apiKey }) => [slug, apiKey])),
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

  // Extended roles only: the intern and paralegal payloads carry no new keys,
  // so the form they are served by sees exactly what it saw before these roles
  // existed.
  const extended = extendedRole(role.apiKey);
  if (extended) {
    // The form enforces these for a better experience -- telling someone their
    // file is too big before they wait for it to upload -- and the server
    // enforces them again, because the form is not a trust boundary. A fresh
    // object each call, so a caller cannot reach the registry's own.
    payload.limits = { ...extended.publicLimits };
    // Sent rather than duplicated in the client, so the dropdowns and the
    // server's list of accepted values cannot drift apart.
    payload.detailOptions = extended.detailOptions;
  }

  return payload;
}

export { questionsFor, writtenQuestionsFor, WRITTEN_QUESTIONS };
