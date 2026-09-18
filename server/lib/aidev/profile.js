import { FIELD_LIMITS } from '../fieldLimits.js';
import { AIDEV_DETAIL_OPTIONS } from './questions.js';

/**
 * The AI Developer role's extra details: where the candidate is, what they
 * have done, where their work can be seen, and when they could start.
 *
 * Stored together in `recruit_applicants.profile` (the jsonb column recruit_016
 * added for the sales role), with this role's own set of keys. Same rules as
 * ../sales/profile.js: every dropdown is checked against its real option list,
 * and a value the form could not have sent is refused, not stored.
 */

/** Multipart field name → the option list its value must come from. */
const CHOICES = {
  qualification: AIDEV_DETAIL_OPTIONS.qualifications,
  experience: AIDEV_DETAIL_OPTIONS.experience,
  heardFrom: AIDEV_DETAIL_OPTIONS.heardFrom,
  noticePeriod: AIDEV_DETAIL_OPTIONS.noticePeriods,
};

/** In the order the form shows them, which is the order errors come back in. */
export const PROFILE_FIELDS = [
  'city',
  'qualification',
  'experience',
  'githubUrl',
  'employer',
  'heardFrom',
  'noticePeriod',
];

export const PROFILE_LIMITS = Object.freeze({
  githubUrl: 300,
  employer: 120,
});

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
  experience: 'Choose your years of development experience',
  noticePeriod: 'Choose your notice period',
};

/**
 * A link a manager can click: http or https, with a host, nothing else.
 *
 * Parsed rather than pattern-matched, so `https://github.com/someone` passes
 * and `javascript:…`, `github.com/someone` (no scheme) or `https://` alone do
 * not. The link is shown on the dashboard, which is why the scheme matters.
 */
function isWebLink(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
}

/**
 * Errors keyed by field name, the same shape as validateDetails, so the form
 * can put each message under the box it belongs to.
 *
 * Required: city, qualification, experience, notice period -- as the design
 * has it. The GitHub link, the employer and "where did you hear about us" are
 * optional; when given, each must still be something we can store and use.
 */
export function validateProfile(values) {
  const errors = {};

  if (!values.city) errors.city = 'Enter your city or area';
  else if (values.city.length > FIELD_LIMITS.city) errors.city = 'That city name is too long';

  for (const field of PROFILE_FIELDS) {
    if (field in CHOICES) {
      const value = values[field];
      if (!value) {
        if (field in REQUIRED_MESSAGE) errors[field] = REQUIRED_MESSAGE[field];
      } else if (!CHOICES[field].includes(value)) {
        errors[field] = 'Please choose one of the options listed';
      }
    } else if (field === 'githubUrl' && values.githubUrl) {
      if (values.githubUrl.length > PROFILE_LIMITS.githubUrl) errors.githubUrl = 'That link is too long';
      else if (!isWebLink(values.githubUrl)) errors.githubUrl = 'Enter a full link, starting with https://';
    } else if (field === 'employer' && values.employer.length > PROFILE_LIMITS.employer) {
      errors.employer = 'That employer name is too long';
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
    githubUrl: values.githubUrl || null,
    employer: values.employer || null,
    heardFrom: values.heardFrom || null,
    noticePeriod: values.noticePeriod,
  };
}
