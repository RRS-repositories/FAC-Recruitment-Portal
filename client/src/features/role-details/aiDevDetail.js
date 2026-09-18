/**
 * The AI developer applicant's expanded row: which rows are theirs and which
 * profile fields to show. No React and no aliased imports, so it runs under
 * `node --test` as it is.
 */

/**
 * Whether a normalised applicant is an AI developer applicant. `ai-developer`
 * is the slug normalise.js maps `india_aidev` to via ROLES; the raw enum is
 * accepted too, so the row still shows the right answers if the ROLES entry
 * were ever missing.
 */
export const isAiDevApplicant = (applicant) =>
  applicant?.role === 'ai-developer' || applicant?.role === 'india_aidev';

/** `application.profile` keys, in the order the Details section shows them. */
export const AI_DEV_FIELDS = Object.freeze([
  { key: 'city', label: 'City' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'experience', label: 'Experience' },
  { key: 'githubUrl', label: 'GitHub / portfolio', kind: 'link' },
  { key: 'employer', label: 'Current employer' },
  { key: 'heardFrom', label: 'Heard about us' },
  { key: 'noticePeriod', label: 'Notice period' },
]);
