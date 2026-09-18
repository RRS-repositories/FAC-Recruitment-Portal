/**
 * Pure helpers shared by every role page — no React, no DOM, no aliases —
 * so `npm test` can run them directly (see helpers.test.js).
 *
 * Everything here is UX. The server re-checks every one of these rules; a
 * candidate who gets past them in the browser is still refused there.
 */

const MB = 1024 * 1024;

/** Words, as the designs count them: whitespace-separated runs. */
export const wordCount = (text) =>
  typeof text === 'string' && text.trim() ? text.trim().split(/\s+/).length : 0;

/** Bytes to the designs' "1.4" (MB, one decimal). */
export const formatMB = (bytes) => (bytes / MB).toFixed(1);

/** Whole megabytes for a limit sentence: 26214400 → 25. */
export const wholeMB = (bytes) => Math.round(bytes / MB);

const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** "Ten real situations…" — spelled out while the server sends twelve or fewer. */
export const countWord = (n) => NUMBER_WORDS[n] ?? String(n);

const listNumbers = (numbers) => numbers.join(', ');

/**
 * The designs' written-step message, or '' when every answer is long enough.
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

/** The designs' assessment message, or '' when all are answered. */
export function missingAnswersMessage(questions, answers) {
  const missing = [];
  questions.forEach((q, i) => {
    if (!isAnswered(q, answers?.[q.id])) missing.push(i + 1);
  });
  if (!missing.length) return '';
  return `Please answer question${missing.length > 1 ? 's' : ''} ${listNumbers(missing)}.`;
}

/** Same loose check as the designs; the server does the real one. */
export const looksLikeEmail = (value) => /\S+@\S+\.\S+/.test(value ?? '');

/** An http(s) address with a host that has a dot in it: "https://github.com/me". */
export function looksLikeUrl(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(text)) return false;
  try {
    const url = new URL(text);
    return (url.protocol === 'http:' || url.protocol === 'https:') && /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** The empty details object for a role's field list, in field order. */
export const emptyDetails = (fields) => Object.fromEntries(fields.map((f) => [f.name, '']));

/**
 * { field: true } for each field that would stop Continue.
 *
 * A field is refused when it is `required` and blank, or when it has a value
 * that fails its `check` ('email' or 'url'). An optional field left blank is
 * never checked.
 */
export function detailProblems(details, fields) {
  const problems = {};
  for (const field of fields) {
    const value = String(details?.[field.name] ?? '').trim();
    if (!value) {
      if (field.required) problems[field.name] = true;
      continue;
    }
    if (field.check === 'email' && !looksLikeEmail(value)) problems[field.name] = true;
    if (field.check === 'url' && !looksLikeUrl(value)) problems[field.name] = true;
  }
  return problems;
}

/**
 * The single line under the details grid, or '' when nothing is wrong.
 *
 * The design's own sentence covers blanks and a bad email. A malformed
 * optional field (a portfolio link, say) gets the field's own `message`
 * instead — telling somebody to "complete every field" when they have is no
 * help — unless something else is also wrong, when the design's line leads.
 */
export function detailsMessage(problems, fields, designMessage) {
  const names = Object.keys(problems);
  if (!names.length) return '';
  const own = fields.filter((f) => problems[f.name] && f.check === 'url' && f.message);
  if (own.length === names.length) return own[0].message;
  return designMessage;
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

/**
 * Where a server rejection belongs.
 *
 * Returns the page to send the candidate back to and the message to show
 * there, so a refused answer is explained on the step that owns it rather
 * than as a generic failure under the Submit button.
 *
 * `detailNames` are the role's detail fields; `extraSteps` maps any
 * role-specific page (sales' `voice`) to the server field names it owns.
 */
export function stepForServerErrors(errors, { detailNames, extraSteps = {} }) {
  const e = errors || {};
  const detail = detailNames.find((f) => e[f]);
  if (detail) {
    return { page: 'details', message: 'Please check the highlighted details.' };
  }
  const writtenKey = Object.keys(e).find((k) => k === 'written' || /^w\d+$/.test(k));
  if (writtenKey) return { page: 'written', message: String(e[writtenKey]) };
  if (e.answers) return { page: 'assessment', message: String(e.answers) };
  for (const [page, keys] of Object.entries(extraSteps)) {
    const key = keys.find((k) => e[k]);
    if (key) return { page, message: String(e[key]) };
  }
  if (e.cv) return { page: 'cv', message: String(e.cv) };
  if (e.captchaToken) return { page: 'cv', message: String(e.captchaToken) };
  return {
    page: 'cv',
    message: 'Some of your answers were not accepted. Please check them and try again.',
  };
}

/**
 * The dropdown lists: the server's, else the role's fallback, per list.
 * An empty or missing list from an older server falls back rather than
 * leaving a select with nothing to choose.
 */
export function pickDetailOptions(fromServer, fallback) {
  const server = fromServer ?? {};
  return Object.fromEntries(
    Object.keys(fallback).map((key) => {
      const list = Array.isArray(server[key]) ? server[key].filter(Boolean) : [];
      return [key, list.length ? list : fallback[key]];
    }),
  );
}
