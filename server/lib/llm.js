/**
 * The model, behind one switch — in the same shape as the mailer and the
 * captcha, so there is one way to read "is this actually on?".
 *
 *   OLLAMA_API_KEY set    → reviews are sent to the model
 *   OLLAMA_API_KEY unset  → nothing is sent, and the API says so out loud
 *
 * The second mode is not a fallback, it is the default. Turning this on starts
 * sending candidates' CVs and written answers to a third party, so it takes a
 * deliberate act: a key in the environment AND the recruitment_ai_review flag.
 * Neither alone does anything.
 *
 * WHY NO SDK. One POST with a JSON body. A dependency to build that object
 * would be a supply-chain risk taken for nothing, and the CRM has to install
 * whatever this module needs too.
 */

const DEFAULT_BASE = 'https://ollama.com';
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 90_000);

/** 'on' once a key exists. Reported by the API and shown in Settings. */
export const llmMode = () => (process.env.OLLAMA_API_KEY ? 'on' : 'off');

export const llmModel = () => process.env.OLLAMA_MODEL || 'gemma4:31b';

const baseUrl = () => (process.env.OLLAMA_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');

export class LlmError extends Error {
  constructor(message, { retryable = true } = {}) {
    super(message);
    this.name = 'LlmError';
    // A bad key or a rejected prompt will fail identically next time; a
    // timeout or a 502 will not. The worker needs to tell them apart or it
    // spends the retry budget on something that cannot succeed.
    this.retryable = retryable;
  }
}

/**
 * Asks the model one question and insists on JSON back.
 *
 * `format: 'json'` is Ollama's constrained decoding — the model is made to
 * emit syntactically valid JSON rather than asked nicely to. It still has to
 * be validated: valid JSON is not the same as the right shape, and a model
 * that invents a field is not an error the transport layer can catch.
 *
 * @returns {Promise<{parsed: object, raw: object}>}
 */
export async function askForJson({ system, prompt, temperature = 0 }) {
  if (llmMode() === 'off') {
    throw new LlmError('OLLAMA_API_KEY is not set', { retryable: false });
  }

  const body = {
    model: llmModel(),
    stream: false,
    format: 'json',
    // Zero, because this decides how someone is ranked. The same application
    // reviewed twice should not produce two different numbers, and "creative"
    // is the opposite of what is wanted from an assessor.
    options: { temperature },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };

  let response;
  try {
    response = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // A timeout or a dropped connection. Worth trying again later.
    throw new LlmError(`could not reach the model: ${error.message}`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    // 401/403 is a wrong key and 400 is a malformed request: both will fail
    // the same way for ever. 429 and 5xx are worth waiting out.
    const permanent = [400, 401, 403, 404].includes(response.status);
    throw new LlmError(`model returned ${response.status}: ${detail}`, { retryable: !permanent });
  }

  const raw = await response.json().catch(() => null);
  const content = raw?.message?.content;
  if (!content) throw new LlmError('model returned no content');

  let parsed;
  try {
    parsed = JSON.parse(unwrapJson(content));
  } catch {
    throw new LlmError(`model returned content that is not JSON: ${String(content).slice(0, 200)}`);
  }

  return { parsed, raw };
}

/**
 * The JSON out of whatever the model wrapped it in.
 *
 * `format: 'json'` is supposed to make this unnecessary and does not. Gemma
 * returns its object inside a ```json fence, which is valid markdown and
 * invalid JSON, so a straight parse fails on every single review — found by
 * running one before shipping rather than after.
 *
 * Two steps, narrowest first: strip a fence if there is one, and otherwise
 * take everything between the first brace and the last. The second is a blunt
 * instrument, so it is only reached when the first has already failed, and a
 * result that still will not parse is reported rather than guessed at.
 */
export function unwrapJson(content) {
  const text = String(content).trim();

  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenced) return fenced[1].trim();

  if (text.startsWith('{') || text.startsWith('[')) return text;

  const first = text.search(/[[{]/);
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (first !== -1 && last > first) return text.slice(first, last + 1);

  return text;
}

/**
 * Whether the model answers at all, said at boot rather than discovered on the
 * first application — the same reason verifyMail() exists.
 */
export async function verifyLlm() {
  if (llmMode() === 'off') {
    return { ok: false, mode: 'off', detail: 'OLLAMA_API_KEY is not set, so no application is reviewed' };
  }
  try {
    const { parsed } = await askForJson({
      system: 'You reply only with JSON.',
      prompt: 'Reply with exactly {"ok":true}.',
    });
    return { ok: parsed?.ok === true, mode: 'on', detail: `${baseUrl()} as ${llmModel()}` };
  } catch (error) {
    return { ok: false, mode: 'on', detail: error.message };
  }
}
