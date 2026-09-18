/**
 * The header-shaped parts of serving a voice note to a manager.
 *
 * Kept apart from the route so they can be tested without a database or a
 * file: each is a pure function of what the applicant row, or the browser,
 * handed us — and both of those are untrusted.
 */

/** The audio types we will echo back. Anything else is opaque bytes. */
const AUDIO_TYPE = /^audio\/[a-z0-9][a-z0-9.+-]*(;\s*codecs=[a-z0-9.,"' -]+)?$/;

/**
 * The Content-Type to serve. The stored value is whatever the browser
 * claimed at upload, so only a well-formed audio type is repeated; anything
 * else becomes application/octet-stream, which no browser will render.
 */
export function voiceContentType(stored) {
  const mime = typeof stored === 'string' ? stored.trim().toLowerCase() : '';
  return AUDIO_TYPE.test(mime) ? mime : 'application/octet-stream';
}

/**
 * The filename for Content-Disposition. The candidate named this file, so it
 * loses quotes, backslashes, slashes and control characters, anything outside
 * printable ASCII becomes `_`, and it is capped. A header is not the place to
 * find out what somebody called their recording.
 */
export function voiceFilename(stored) {
  const clean = String(stored ?? '')
    .replace(/[\x00-\x1f\x7f"\\/]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .trim()
    .slice(0, 150);
  return clean || 'voice-note';
}

/**
 * One HTTP byte range, for a file of `size` bytes.
 *
 *   null             serve the whole file (no header, several ranges, or a
 *                    header we do not understand — always a correct answer)
 *   'unsatisfiable'  answer 416
 *   { start, end }   inclusive offsets, ready for createReadStream
 */
export function parseRange(header, size) {
  if (typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, first, last] = match;
  if (first === '' && last === '') return null;

  let start;
  let end = size - 1;
  if (first === '') {
    // "bytes=-N" means the last N bytes.
    const suffix = Number(last);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
  } else {
    start = Number(first);
    if (last !== '') end = Math.min(Number(last), size - 1);
  }
  if (!Number.isSafeInteger(start) || start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}
