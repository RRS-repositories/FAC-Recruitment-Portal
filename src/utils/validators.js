// Deliberately permissive: this is a lead form, and an over-strict pattern
// rejects real addresses. The server remains the authority.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validators = {
  name: (value) => (value.trim() ? '' : 'Enter your name'),
  email: (value) => {
    if (!value.trim()) return 'Enter your email address';
    return EMAIL_PATTERN.test(value.trim()) ? '' : 'Enter an email address in the format name@company.co.uk';
  },
};

/** Runs every validator against `values`, returning only the fields in error. */
export function validateAll(values) {
  return Object.entries(validators).reduce((errors, [field, validate]) => {
    const message = validate(values[field] ?? '');
    if (message) errors[field] = message;
    return errors;
  }, {});
}

export default validators;
