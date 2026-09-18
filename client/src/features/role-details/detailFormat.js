/**
 * Plain helpers for the extended applicant details (the expanded dashboard
 * row of the roles that ask their own questions: sales, AI developer). No
 * React and no aliased imports, so they run under `node --test` as they are.
 */

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

/**
 * An assessment question's wording. The server sends it as `question`; a
 * `label` is accepted too, so a question is never drawn as a blank line.
 */
export const questionText = (question) => question?.question ?? question?.label ?? question?.id ?? '';

/**
 * The href for a candidate-supplied link, or null when it must not be one.
 *
 * Only http and https: anything else (`javascript:`, `data:`, a bare
 * `github.com/x` with no scheme) is shown as text instead, because this is a
 * value a stranger typed into a public form and a manager is about to click.
 */
export function externalHref(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
}
