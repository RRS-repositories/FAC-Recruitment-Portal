import { SALES_ROLE } from './sales/role.js';
import { AIDEV_ROLE } from './aidev/role.js';

/**
 * The roles that are more than the original paralegal form.
 *
 * The intern and paralegal roles share one form, one set of written questions
 * and one marking rule (shared/scoring.js), and are submitted to
 * `POST /applications`. Each role registered here is different in the same
 * ways -- its own written questions with word minimums, a details step stored
 * in `profile`, negative-weight marking, a larger CV -- and is submitted to
 * `POST /applications/<slug>` instead. Each lives in a folder of its own
 * (./sales/, ./aidev/); this file only lists them, so nothing about one role
 * is threaded through the shared modules.
 *
 * Every entry has the same shape:
 *
 *   apiKey, slug, title, country, timezone   the facts roles.js serves
 *   writtenQuestions   [{ id, label, minWords }]
 *   questions          the assessment, weights included (server only)
 *   detailOptions      the details step's dropdown lists, sent to the form
 *   limits             what the server enforces (cvMaxBytes, voice limits)
 *   publicLimits       what the form is told about them
 *   hasVoice           whether a voice note is part of the application
 *   score(answers)     0-100, from the weights above
 *   normaliseProfile(body) / validateProfile(values) / profileForStorage(values)
 *   review             { workplace, brief, promptVersion } -- what the model
 *                      review is told about the job (see llmReview.js)
 *   calendar           optional { extraGuestsEnv } -- the .env key listing
 *                      who else joins this role's interviews (meetLink.js)
 *
 * Imported by roles.js and questions.js, which sit underneath validate.js, so
 * nothing reached from here may import validate.js, roles.js or questions.js
 * (see fieldLimits.js), or storage.js (it fixes CV_STORAGE_DIR as it loads).
 */
export const EXTENDED_ROLES = Object.freeze([SALES_ROLE, AIDEV_ROLE]);

const BY_API_KEY = new Map(EXTENDED_ROLES.map((role) => [role.apiKey, role]));

/** The registry entry for an enum value, or null for the intern/paralegal roles. */
export const extendedRole = (apiKey) => BY_API_KEY.get(apiKey) ?? null;

/** Whether a role record (from roleBySlug) is one of these. */
export const isExtendedRole = (role) => BY_API_KEY.has(role?.apiKey);
