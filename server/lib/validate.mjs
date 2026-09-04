import { validateAll, FIELD_LIMITS } from '../../src/utils/validators.js';
import { roleTypes, headcountOptions } from '../../src/data/enquire.js';

/**
 * Server-side validation — the actual trust boundary.
 *
 * The shared field rules come from src/utils/validators.js, the same module the
 * React form uses, so the two cannot disagree about what a valid email is. What
 * is added here is everything the browser has no business being trusted on:
 * allowlisting the dropdown values, and discarding keys nobody asked for.
 */

const ALLOWED_ROLE_TYPES = new Set(roleTypes);
const ALLOWED_HEADCOUNTS = new Set(headcountOptions);

const ACCEPTED_FIELDS = ['name', 'company', 'email', 'phone', 'roleType', 'headcount', 'message'];

/** Trims, coerces to string, and drops anything not in ACCEPTED_FIELDS. */
export function normalise(body) {
  const clean = {};
  for (const field of ACCEPTED_FIELDS) {
    const raw = body?.[field];
    // Reject non-strings outright rather than stringifying them — an object or
    // array here means either a bug or someone probing.
    clean[field] = typeof raw === 'string' ? raw.trim() : '';
  }
  return clean;
}

/**
 * Returns `{ field: message }` for everything wrong, or an empty object.
 * A dropdown value outside its list is rejected, not silently blanked: the form
 * cannot produce one, so its presence means the payload was hand-made.
 */
export function validateEnquiry(values) {
  const errors = validateAll(values);

  if (values.roleType && !ALLOWED_ROLE_TYPES.has(values.roleType)) {
    errors.roleType = 'Choose a role type from the list';
  }
  if (values.headcount && !ALLOWED_HEADCOUNTS.has(values.headcount)) {
    errors.headcount = 'Choose a team size from the list';
  }

  return errors;
}

export { FIELD_LIMITS };
