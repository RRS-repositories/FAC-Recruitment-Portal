/**
 * Enquiry field rules — the single source of truth for both sides.
 *
 * This module is deliberately isomorphic: it imports nothing, touches no
 * browser or Node API, and is loaded unchanged by the React form and by the
 * intake service. Client-side validation is a UX affordance; the server runs
 * these same rules as the actual trust boundary, and the two can never drift
 * because there is only one copy.
 */

// Deliberately permissive: this is a lead form, and an over-strict pattern
// rejects real addresses. The server remains the authority.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Maximum accepted length per field. These mirror the CHECK constraints in
 * migrations/atlas_enquiries_001.sql — if you change one, change both, or the
 * database will reject a payload the form accepted.
 */
export const FIELD_LIMITS = {
  name: 120,
  company: 160,
  email: 254,
  phone: 40,
  roleType: 60,
  headcount: 10,
  message: 4000,
};

export const validators = {
  name: (value) => {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return 'Enter your name';
    if (trimmed.length > FIELD_LIMITS.name) return `Keep your name under ${FIELD_LIMITS.name} characters`;
    return '';
  },
  email: (value) => {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return 'Enter your email address';
    if (trimmed.length > FIELD_LIMITS.email) return 'That email address is too long';
    return EMAIL_PATTERN.test(trimmed)
      ? ''
      : 'Enter an email address in the format name@company.co.uk';
  },
};

/** Optional fields: no presence rule, but still length-bounded. */
export const optionalValidators = {
  company: (value) => lengthOnly(value, 'company', 'Company name'),
  phone: (value) => lengthOnly(value, 'phone', 'Phone number'),
  roleType: (value) => lengthOnly(value, 'roleType', 'Role type'),
  headcount: (value) => lengthOnly(value, 'headcount', 'Headcount'),
  message: (value) => lengthOnly(value, 'message', 'Message'),
};

function lengthOnly(value, field, label) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length > FIELD_LIMITS[field]) {
    return `${label} must be under ${FIELD_LIMITS[field]} characters`;
  }
  return '';
}

/** Runs every rule against `values`, returning only the fields in error. */
export function validateAll(values) {
  const all = { ...validators, ...optionalValidators };
  return Object.entries(all).reduce((errors, [field, validate]) => {
    const message = validate(values[field] ?? '');
    if (message) errors[field] = message;
    return errors;
  }, {});
}

export default validators;
