/**
 * Pure helpers for the sales application — no React, no DOM, no aliases —
 * so `npm test` can run them directly (see helpers.test.js).
 *
 * Everything here is UX. The server re-checks every one of these rules; a
 * candidate who gets past them in the browser is still refused there.
 */

const MB = 1024 * 1024;

/** Words, as the design counts them: whitespace-separated runs. */
export const wordCount = (text) =>
  typeof text === 'string' && text.trim() ? text.trim().split(/\s+/).length : 0;

/** 65 → "01:05". The recorder's clock and the file pill both use it. */
export function formatClock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Bytes to the design's "1.4" (MB, one decimal). */
export const formatMB = (bytes) => (bytes / MB).toFixed(1);

/** Whole megabytes for a limit sentence: 26214400 → 25. */
export const wholeMB = (bytes) => Math.round(bytes / MB);

/** 420 → "7 minutes"; 60 → "1 minute". */
export function minutesLabel(seconds) {
  const m = Math.round(seconds / 60);
  return `${m} minute${m === 1 ? '' : 's'}`;
}

const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** "Ten real situations…" — spelled out while the server sends ten. */
export const countWord = (n) => NUMBER_WORDS[n] ?? String(n);

const listNumbers = (numbers) => numbers.join(', ');

/**
 * The design's written-step message, or '' when every answer is long enough.
 * "Question 2 needs a few more words." / "Questions 1, 4 need a few more words."
 */
export function shortWrittenMessage(questions, written) {
  const short = [];
  questions.forEach((q, i) => {
    if (wordCount(written?.[q.id]) < (q.minWords ?? 0)) short.push(i + 1);
  });
  if (!short.length) return '';
  const many = short.length > 1;
  return `Question${many ? 's' : ''} ${listNumbers(short)} need${many ? '' : 's'} a few more words.`;
}

/** Whether a single or multi question has an answer in the stored shape. */
export function isAnswered(question, answer) {
  if (question.multi) return Array.isArray(answer) && answer.length > 0;
  return Number.isInteger(answer);
}

/** The design's assessment message, or '' when all are answered. */
export function missingAnswersMessage(questions, answers) {
  const missing = [];
  questions.forEach((q, i) => {
    if (!isAnswered(q, answers?.[q.id])) missing.push(i + 1);
  });
  if (!missing.length) return '';
  return `Please answer question${missing.length > 1 ? 's' : ''} ${listNumbers(missing)}.`;
}

/** Same loose check as the design; the server does the real one. */
export const looksLikeEmail = (value) => /\S+@\S+\.\S+/.test(value ?? '');

/** Fields the design requires. `heardFrom` is optional there, and here. */
const REQUIRED_DETAILS = [
  'fullName',
  'email',
  'phone',
  'city',
  'qualification',
  'experience',
  'noticePeriod',
];

/** { field: true } for each field that would stop Continue. */
export function detailProblems(details) {
  const problems = {};
  for (const field of REQUIRED_DETAILS) {
    if (!String(details?.[field] ?? '').trim()) problems[field] = true;
  }
  if (!problems.email && !looksLikeEmail(details.email)) problems.email = true;
  return problems;
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

const CV_EXTENSIONS = ['.pdf', '.doc', '.docx'];
export const CV_ACCEPT = CV_EXTENSIONS.join(',');

export function checkCvFile(file, { maxBytes }) {
  if (!file) return 'Please choose your CV.';
  const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
  if (!CV_EXTENSIONS.includes(ext)) {
    return "That file type isn't supported. Please upload a PDF, DOC or DOCX file.";
  }
  if (file.size > maxBytes) return `CV is over ${wholeMB(maxBytes)} MB.`;
  return '';
}

const DETAIL_FIELDS = [
  'fullName',
  'email',
  'phone',
  'city',
  'qualification',
  'experience',
  'heardFrom',
  'noticePeriod',
];

/**
 * Where a server rejection belongs.
 *
 * Returns the page to send the candidate back to and the message to show
 * there, so a refused voice note is explained on the voice step rather than
 * as a generic failure under the Submit button.
 */
export function stepForServerErrors(errors) {
  const e = errors || {};
  const detail = DETAIL_FIELDS.find((f) => e[f]);
  if (detail) {
    return { page: 'details', message: 'Please check the highlighted details.' };
  }
  const writtenKey = Object.keys(e).find((k) => k === 'written' || /^w\d+$/.test(k));
  if (writtenKey) return { page: 'written', message: String(e[writtenKey]) };
  if (e.answers) return { page: 'assessment', message: String(e.answers) };
  const voiceKey = ['voice', 'voiceDuration', 'voiceSource'].find((k) => e[k]);
  if (voiceKey) return { page: 'voice', message: String(e[voiceKey]) };
  if (e.cv) return { page: 'cv', message: String(e.cv) };
  if (e.captchaToken) return { page: 'cv', message: String(e.captchaToken) };
  return {
    page: 'cv',
    message: 'Some of your answers were not accepted. Please check them and try again.',
  };
}
