/**
 * Everything specific to the Sales & Customer Service (South Africa) role, in
 * one place.
 *
 * The other two roles share one form and one marking rule. This one adds a
 * details step, a voice note, word minimums and negative weights, and keeping
 * all of that here -- rather than threaded through the shared modules -- is
 * what lets the paralegal and intern paths stay exactly as they were.
 *
 * NOT imported by roles.js or questions.js: they reach this role through the
 * extended-role registry (../extendedRoles.js → ./role.js), which leaves out
 * the voice note. This file reaches voice.js and so storage.js, which fixes
 * CV_STORAGE_DIR as it loads -- too heavy for a module half the server
 * imports. The application route takes the voice helpers from here.
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
