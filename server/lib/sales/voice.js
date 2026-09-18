import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UploadError, deleteCv, resolveCv } from '../storage.js';
import { SALES_LIMITS } from './limits.js';

/**
 * The sales role's voice note: checking it, and keeping it.
 *
 * WHERE. Next to the candidate's CV, under the same private root
 * (CV_STORAGE_DIR) and in the same per-applicant directory -- so the retention
 * job, the backups and the "never under the publicly served rclone root" rule
 * that already protect a CV protect this too. A recording of someone's voice
 * is at least as personal as their CV.
 *
 * WHAT. Decided by the file's first bytes, never by its name or the MIME type
 * the browser claimed. Both of those are statements from the client; the
 * content is the evidence. The stored name is fixed (`voice.<ext>`), so an
 * upload name cannot influence the path at all.
 */

/** An UploadError the route reports under `errors.voice`, not `errors.cv`. */
export class VoiceUploadError extends UploadError {
  constructor(message) {
    super(message);
    this.field = 'voice';
  }
}

export const VOICE_SOURCES = ['recorded', 'uploaded'];

const MB = 1024 * 1024;

export const VOICE_MESSAGES = {
  missing: 'Please add your voice note.',
  empty: 'Your voice note is empty. Please record or upload it again.',
  tooLarge: `Your voice note is larger than ${SALES_LIMITS.voiceMaxBytes / MB} MB. Please compress it or record a shorter one.`,
  notAudio:
    'That file does not look like an audio recording. Please record your note here, or upload an MP3, M4A, WAV, OGG, AAC or WebM file.',
  duration: 'We could not tell how long your voice note is. Please record or upload it again.',
  tooShort: `Your voice note is under ${SALES_LIMITS.voiceMinSeconds} seconds. Please record a little more.`,
  tooLong: `Your voice note is longer than ${SALES_LIMITS.voiceMaxSeconds / 60} minutes. Please trim it or record a shorter one.`,
  source: 'We could not tell how your voice note was added. Please record or upload it again.',
};

const ascii = (buffer, start, text) =>
  buffer.length >= start + text.length && buffer.toString('latin1', start, start + text.length) === text;

/**
 * Which audio container this is, from its signature -- or null.
 *
 * The formats a phone or browser actually produces: MediaRecorder gives WebM
 * (Chrome, Firefox, Android) or MP4 (Safari, iOS); a phone's voice-memo app
 * gives M4A, AMR-in-MP4 or MP3; a desktop gives WAV. AMR on its own and FLAC
 * are left out until somebody needs them -- a format nobody sends is only
 * attack surface.
 */
export function detectAudio(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // EBML: Matroska and its WebM subset. The DocType sits a few bytes in; a
  // WebM is labelled as such so a download opens in the right player.
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    const head = buffer.toString('latin1', 0, Math.min(buffer.length, 64));
    return head.includes('webm')
      ? { ext: '.webm', contentType: 'audio/webm' }
      : { ext: '.mka', contentType: 'audio/x-matroska' };
  }

  if (ascii(buffer, 0, 'OggS')) return { ext: '.ogg', contentType: 'audio/ogg' };

  if (ascii(buffer, 0, 'RIFF') && ascii(buffer, 8, 'WAVE')) return { ext: '.wav', contentType: 'audio/wav' };

  // ISO base media (MP4 / M4A / 3GP): a box size, then `ftyp`.
  if (ascii(buffer, 4, 'ftyp')) return { ext: '.m4a', contentType: 'audio/mp4' };

  if (ascii(buffer, 0, 'ID3')) return { ext: '.mp3', contentType: 'audio/mpeg' };

  if (buffer[0] === 0xff) {
    // Both ADTS AAC and MPEG audio open with an 11-bit frame sync. They differ
    // in the two "layer" bits: always 00 for ADTS, never 00 for MPEG audio
    // (00 is reserved there). Testing those bits, rather than the loose
    // "0xFFE?" check, is what tells an .aac from an .mp3.
    if ((buffer[1] & 0xf6) === 0xf0) return { ext: '.aac', contentType: 'audio/aac' };
    if ((buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0) {
      return { ext: '.mp3', contentType: 'audio/mpeg' };
    }
  }

  return null;
}

/**
 * The file's own checks: present, not too big, really audio. Returns the
 * message to show, or null when it is fine. Run before anything is written,
 * so a bad file never costs a database round trip.
 */
export function checkVoiceFile(file) {
  if (!file) return VOICE_MESSAGES.missing;
  if (!file.buffer?.length) return VOICE_MESSAGES.empty;
  if (file.buffer.length > SALES_LIMITS.voiceMaxBytes) return VOICE_MESSAGES.tooLarge;
  if (!detectAudio(file.buffer)) return VOICE_MESSAGES.notAudio;
  return null;
}

/**
 * The duration the form measured, in whole seconds -- or null if it is not
 * one. Multipart fields arrive as strings; a JSON caller might send a number.
 * Either way only a plain whole number is accepted: "12.5", "1e2" and " 12"
 * are refused rather than guessed at.
 */
export function parseVoiceDuration(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  if (typeof raw !== 'string' || !/^\d{1,5}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * The form's statement about the note: how long it is, and whether it was
 * recorded here or uploaded. Returns `{ error }` or `{ durationSec, source }`.
 *
 * The duration is the browser's measurement, not ours -- the server does not
 * decode audio. It is still checked, because it is what the dashboard shows
 * and what the manager relies on, and a value the form would never have sent
 * (0, 3600) is refused rather than displayed as fact.
 */
export function validateVoiceMeta({ duration, source }) {
  const durationSec = parseVoiceDuration(duration);
  // An UPLOADED file whose length the browser could not read arrives as 0
  // (the design accepts those, and so do we: the manager listens to it
  // anyway). Stored as unknown, not refused as "under 10 seconds" -- which
  // would tell the candidate something untrue about their recording. A note
  // RECORDED in the form always has a measured length, so it keeps the check.
  if (source === 'uploaded' && durationSec === 0) return { durationSec: null, source };
  if (durationSec === null) return { error: VOICE_MESSAGES.duration };
  if (durationSec < SALES_LIMITS.voiceMinSeconds) return { error: VOICE_MESSAGES.tooShort };
  if (durationSec > SALES_LIMITS.voiceMaxSeconds + SALES_LIMITS.voiceToleranceSeconds) {
    return { error: VOICE_MESSAGES.tooLong };
  }
  if (!VOICE_SOURCES.includes(source)) return { error: VOICE_MESSAGES.source };
  return { durationSec, source };
}

/** What to call the file when a manager downloads it. Never used in a path. */
function displayName(originalName, ext) {
  const name = typeof originalName === 'string' ? originalName.trim() : '';
  // MediaRecorder blobs arrive as "blob" or with no name at all.
  if (!name || name === 'blob') return `voice-note${ext}`;
  return name.slice(0, 255);
}

/**
 * Validates and stores one voice note. Returns what to record on the
 * applicant row: `{ key, bytes, contentType, filename }`.
 *
 * Throws VoiceUploadError for anything the candidate can fix, so the route
 * reports it against the voice step rather than the CV.
 */
export async function storeVoice({ applicantId, originalName, buffer }) {
  if (!applicantId) throw new Error('storeVoice needs the applicant id to file the note under.');
  const problem = checkVoiceFile({ buffer });
  if (problem) throw new VoiceUploadError(problem);

  const { ext, contentType } = detectAudio(buffer);
  const key = `${applicantId}/voice${ext}`;
  // resolveCv refuses a key that escapes the root, so even a malformed id
  // cannot write outside it.
  const full = resolveCv(key);
  await mkdir(path.dirname(full), { recursive: true });
  try {
    await writeFile(full, buffer, { mode: 0o640 });
  } catch (error) {
    // A write that fails part-way (a full disk) can leave half a file behind,
    // and the caller has no key to clean it up with -- we never returned one.
    await deleteCv(key);
    throw error;
  }

  return { key, bytes: buffer.length, contentType, filename: displayName(originalName, ext) };
}

/** Removes a stored note. Same guard, same "false rather than throw" as a CV. */
export const deleteVoice = (key) => deleteCv(key);
