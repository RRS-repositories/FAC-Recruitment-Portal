import { ROLE_BY_API_KEY } from './roles.js';

/**
 * Server-side validation — the actual trust boundary.
 *
 * The client validates the same fields for a better experience, but nothing
 * here trusts that it did. Everything is re-checked, dropdown answers are
 * checked against the real option list, and unknown keys are discarded rather
 * than stored.
 */

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FIELD_LIMITS = {
  fullName: 120,
  email: 254,
  phone: 40,
  city: 120,
  written: 4000,
};

const TEXT_FIELDS = ['fullName', 'email', 'phone', 'city'];

/** Coerces to trimmed strings and drops anything not expected. */
export function normaliseDetails(body) {
  const clean = {};
  for (const field of TEXT_FIELDS) {
    const raw = body?.[field];
    // Reject non-strings rather than stringifying: an object here means a bug
    // or someone probing, and "[object Object]" is not a name.
    clean[field] = typeof raw === 'string' ? raw.trim() : '';
  }
  return clean;
}

export function validateDetails(values) {
  const errors = {};

  if (!values.fullName) errors.fullName = 'Enter your full name';
  else if (values.fullName.length > FIELD_LIMITS.fullName) errors.fullName = 'That name is too long';

  if (!values.email) errors.email = 'Enter your email address';
  else if (values.email.length > FIELD_LIMITS.email) errors.email = 'That email address is too long';
  else if (!EMAIL.test(values.email)) errors.email = 'Enter a valid email address';

  if (!values.phone) errors.phone = 'Enter a phone number we can reach you on';
  else if (values.phone.length > FIELD_LIMITS.phone) errors.phone = 'That phone number is too long';

  if (values.city && values.city.length > FIELD_LIMITS.city) errors.city = 'That city name is too long';

  return errors;
}

/** Written answers: three required, each length-bounded to the column. */
export function validateWritten(written, questionIds) {
  const errors = {};
  for (const id of questionIds) {
    const value = typeof written?.[id] === 'string' ? written[id].trim() : '';
    if (!value) errors[id] = 'This answer is required';
    else if (value.length > FIELD_LIMITS.written) errors[id] = 'That answer is too long';
  }
  return errors;
}

/**
 * Assessment answers.
 *
 * An index outside the option list, or a multi-select answer on a
 * single-choice question, cannot come from the form — so it is rejected rather
 * than coerced. Silently accepting it would let a crafted payload land a
 * score the questions never awarded.
 */
export function validateAnswers(answers, questions) {
  const errors = {};

  for (const question of questions) {
    const answer = answers?.[question.id];

    if (answer === undefined || answer === null) {
      errors[question.id] = 'This question must be answered';
      continue;
    }

    if (question.multi) {
      if (!Array.isArray(answer) || answer.length === 0) {
        errors[question.id] = 'Select at least one option';
      } else if (
        answer.some((i) => !Number.isInteger(i) || i < 0 || i >= question.options.length) ||
        new Set(answer).size !== answer.length
      ) {
        errors[question.id] = 'Invalid selection';
      }
    } else if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
      errors[question.id] = 'Invalid selection';
    }
  }

  return errors;
}

export function resolveRole(apiKey) {
  return ROLE_BY_API_KEY[apiKey] ?? null;
}

/** Whether an errors object from any of the above is empty. */
export const hasErrors = (errors) => Object.keys(errors).length > 0;
