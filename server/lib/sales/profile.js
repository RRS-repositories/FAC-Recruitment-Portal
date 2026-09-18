import { FIELD_LIMITS } from '../fieldLimits.js';
import { SALES_DETAIL_OPTIONS } from './questions.js';

/**
 * The sales role's extra details: where the candidate is, what they have done,
 * and when they could start.
 *
 * Stored together in `recruit_applicants.profile` (recruit_016) rather than as
 * five new columns. They are specific to one role, the other roles leave the
 * column NULL, and the list of what we ask is the kind of thing that changes
 * after the first week of real applications.
 *
 * Every dropdown is checked against its real option list, as validateAnswers
 * does for the assessment: a value the form could not have sent is refused,
 * not stored, so a later count of "how many said 3–5 years" is a count of
 * answers a candidate actually chose.
 */

/** Multipart field name → the option list its value must come from. */
const CHOICES = {
  qualification: SALES_DETAIL_OPTIONS.qualifications,
  experience: SALES_DETAIL_OPTIONS.experience,
  heardFrom: SALES_DETAIL_OPTIONS.heardFrom,
  noticePeriod: SALES_DETAIL_OPTIONS.noticePeriods,
};

export const PROFILE_FIELDS = ['city', ...Object.keys(CHOICES)];

/** Coerces to trimmed strings and drops anything not expected. */
export function normaliseProfile(body) {
  const clean = {};
  for (const field of PROFILE_FIELDS) {
    const raw = body?.[field];
    // Non-strings become empty, as in normaliseDetails: an object here is a
    // bug or a probe, never an answer.
    clean[field] = typeof raw === 'string' ? raw.trim() : '';
  }
  return clean;
}

const REQUIRED_MESSAGE = {
  qualification: 'Choose your highest qualification',
  experience: 'Choose your years of sales or call-centre experience',
  noticePeriod: 'Choose your notice period',
};

/**
 * Errors keyed by field name, the same shape as validateDetails, so the form
 * can put each message under the box it belongs to.
 *
 * Everything is required except "where did you hear about us" -- a marketing
 * question nobody should be refused a job over.
 */
export function validateProfile(values) {
  const errors = {};

  if (!values.city) errors.city = 'Enter your city or area';
  else if (values.city.length > FIELD_LIMITS.city) errors.city = 'That city name is too long';

  for (const [field, options] of Object.entries(CHOICES)) {
    const value = values[field];
    if (!value) {
      if (field in REQUIRED_MESSAGE) errors[field] = REQUIRED_MESSAGE[field];
    } else if (!options.includes(value)) {
      errors[field] = 'Please choose one of the options listed';
    }
  }

  return errors;
}

/** What goes into the `profile` column. An unanswered optional field is null. */
export function profileForStorage(values) {
  return {
    city: values.city,
    qualification: values.qualification,
    experience: values.experience,
    heardFrom: values.heardFrom || null,
    noticePeriod: values.noticePeriod,
  };
}
