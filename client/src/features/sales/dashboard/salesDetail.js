/**
 * Plain helpers for the sales applicant's expanded row. No React and no
 * imports, so they run under `node --test` as they are.
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
 * The chosen option label(s) for one assessment question.
 *
 * Answers are stored as option indexes -- a number for a single choice, an
 * array of numbers for a multi-select. Returns an array of labels; empty when
 * the question was not answered or the index no longer matches an option.
 */
export function chosenLabels(question, answer) {
  if (answer === undefined || answer === null) return [];
  const options = Array.isArray(question?.options) ? question.options : [];
  const indexes = Array.isArray(answer) ? answer : [answer];
  return indexes
    .map((index) => options[index]?.label)
    .filter((label) => typeof label === 'string' && label.length > 0);
}

/** Words in an answer, for the count beside each written question. */
export const wordCount = (text) =>
  typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0;
