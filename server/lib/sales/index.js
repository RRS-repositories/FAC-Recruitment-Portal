/**
 * Everything specific to the Sales & Customer Service (South Africa) role, in
 * one place.
 *
 * The other two roles share one form and one marking rule. This one adds a
 * details step, a voice note, word minimums and negative weights, and keeping
 * all of that here -- rather than threaded through the shared modules -- is
 * what lets the paralegal and intern paths stay exactly as they were.
 *
 * NOT imported by roles.js or questions.js: they take the plain data modules
 * directly (questions.js, limits.js), because this file reaches validate.js,
 * which imports roles.js, and that would be a cycle.
 */
import { SALES_ROLE_KEY } from './limits.js';

export { SALES_ROLE_KEY, SALES_LIMITS } from './limits.js';
export { SALES_QUESTIONS, SALES_WRITTEN_QUESTIONS, SALES_DETAIL_OPTIONS } from './questions.js';
export { scoreSales, SALES_MAX_SCORE } from './scoring.js';
export { normaliseProfile, validateProfile, profileForStorage, PROFILE_FIELDS } from './profile.js';
export {
  VoiceUploadError,
  VOICE_MESSAGES,
  VOICE_SOURCES,
  detectAudio,
  checkVoiceFile,
  parseVoiceDuration,
  validateVoiceMeta,
  storeVoice,
  deleteVoice,
} from './voice.js';

/** Whether a role record (from roleBySlug) is the sales role. */
export const isSalesRole = (role) => role?.apiKey === SALES_ROLE_KEY;
