/**
 * Pure helpers for the sales voice note — no React, no DOM, no aliases —
 * so `npm test` can run them directly (see voiceHelpers.test.js).
 *
 * The voice note is the one step only sales has; everything the role pages
 * share is in features/role-page/helpers.js. All of this is UX: the server
 * re-checks every rule.
 */
import { wholeMB } from '../role-page/helpers.js';

/** 65 → "01:05". The recorder's clock and the file pill both use it. */
export function formatClock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 420 → "7 minutes"; 60 → "1 minute". */
export function minutesLabel(seconds) {
  const m = Math.round(seconds / 60);
  return `${m} minute${m === 1 ? '' : 's'}`;
}

const AUDIO_EXTENSION = /\.(mp3|m4a|wav|ogg|aac|webm)$/i;

/** Type and size, checked before anything is read. '' means fine. */
export function checkAudioFile(file, { maxBytes }) {
  if (!file) return 'Please choose an audio file.';
  if (!/^audio\//.test(file.type || '') && !AUDIO_EXTENSION.test(file.name || '')) {
    return "That doesn't look like an audio file.";
  }
  if (file.size > maxBytes) {
    return `File is over ${wholeMB(maxBytes)} MB. Please compress it or record a shorter note.`;
  }
  return '';
}

/**
 * Length of an uploaded recording. An unknown length (NaN, Infinity — some
 * browsers cannot read it from the file) is let through, as in the design;
 * the server has the final say.
 *
 * Two seconds of grace over the cap, as the design allows: a phone's "7:00"
 * recording is often 7:00.8 by the time it is saved.
 */
export function checkAudioDuration(seconds, { minSeconds, maxSeconds }) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds > maxSeconds + 2) {
    return `Your recording is ${formatClock(seconds)} — the limit is ${minutesLabel(maxSeconds)}. Please trim it or record a shorter one.`;
  }
  if (seconds < minSeconds) {
    return `That recording is under ${minSeconds} seconds — give us a bit more.`;
  }
  return '';
}

/** In-browser recording: only the lower bound, the recorder enforces the cap. */
export const recordingTooShort = (seconds, minSeconds) =>
  seconds < minSeconds ? `That was under ${minSeconds} seconds — give us a bit more.` : '';

/** A filename for a recording, from the recorder's MIME type. */
export function voiceFileName(mime) {
  const type = String(mime || '').split(';')[0].trim().toLowerCase();
  if (type === 'audio/mp4' || type === 'audio/x-m4a' || type === 'audio/aac') return 'voice-note.m4a';
  if (type === 'audio/ogg') return 'voice-note.ogg';
  if (type === 'audio/mpeg') return 'voice-note.mp3';
  if (type === 'audio/wav' || type === 'audio/x-wav') return 'voice-note.wav';
  return 'voice-note.webm';
}

/**
 * The voice note's part of the multipart body, after the CV — the sales
 * config's `appendExtras`. `voice` is the recorder's value, or null.
 */
export function appendVoice(form, voice) {
  if (!voice?.file) return;
  form.set('voice', voice.file, voice.file.name || 'voice-note.webm');
  form.set('voiceDuration', String(Math.max(0, Math.round(voice.duration || 0))));
  form.set('voiceSource', voice.source === 'uploaded' ? 'uploaded' : 'recorded');
}
