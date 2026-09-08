import { publicQuestionsFor, questionsFor, WRITTEN_QUESTIONS } from './questions.js';

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

  return {
    slug: role.slug,
    title: role.title,
    country: role.country,
    timezone: role.timezone,
    writtenQuestions: WRITTEN_QUESTIONS,
    // Weights stripped — see questions.js for why that matters.
    questions: publicQuestionsFor(role.apiKey),
  };
}

export { questionsFor, WRITTEN_QUESTIONS };
