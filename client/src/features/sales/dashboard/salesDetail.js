/**
 * Plain helpers for the sales applicant's expanded row -- the voice note and
 * which profile fields to show. No React and no imports, so they run under
 * `node --test` as they are.
 */

/**
 * Whether a normalised applicant is a sales applicant. `sales` is the slug
 * normalise.js maps `sa_sales` to via ROLES; the raw enum is accepted too, so
 * the row still shows the right answers if the ROLES entry were ever missing.
 */
export const isSalesApplicant = (applicant) =>
  applicant?.role === 'sales' || applicant?.role === 'sa_sales';

/** Audio subtypes whose name is not the extension people expect. */
const EXT_BY_SUBTYPE = { mpeg: 'mp3', mp4: 'm4a', 'x-m4a': 'm4a', 'x-wav': 'wav', wave: 'wav' };

/**
 * The extension to save a voice note with: the stored filename's own, if it
 * has one, otherwise one derived from the MIME type (`audio/webm;codecs=opus`
 * becomes `webm`), otherwise `webm` -- what the in-browser recorder produces.
 */
export function voiceExtension(voice) {
  const fromName = /\.([a-z0-9]{1,5})$/i.exec(voice?.filename ?? '');
  if (fromName) return fromName[1].toLowerCase();

  const subtype = (voice?.mime ?? '').split('/')[1]?.split(';')[0]?.trim().toLowerCase();
  if (!subtype) return 'webm';
  return EXT_BY_SUBTYPE[subtype] ?? subtype.replace(/^x-/, '');
}

/** `Jane Doe` → `Jane_Doe_voice-note.webm`. Characters a filesystem dislikes are dropped. */
export function voiceNoteFilename(fullName, voice) {
  const name =
    String(fullName ?? '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_') || 'applicant';
  return `${name}_voice-note.${voiceExtension(voice)}`;
}

/**
 * `application.profile` keys, in the order the Details section shows them.
 * The answers and assessment helpers are shared with the other roles that ask
 * their own questions, in features/role-details/detailFormat.js.
 */
export const SALES_FIELDS = Object.freeze([
  { key: 'city', label: 'City' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'experience', label: 'Experience' },
  { key: 'heardFrom', label: 'Heard about us' },
  { key: 'noticePeriod', label: 'Notice period' },
]);
