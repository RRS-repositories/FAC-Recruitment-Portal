/**
 * The model's review of one application: how well it fits, and whether the
 * writing reads as AI-assisted.
 *
 * Runs as a background job for the same reason email does. A model call takes
 * seconds and can fail, and nobody should be turned away from applying because
 * an external service was slow. Rows are claimed with FOR UPDATE SKIP LOCKED,
 * exactly as the outbox claims email, so two workers cannot review the same
 * application twice.
 *
 * TWO RULES THIS FILE EXISTS TO KEEP.
 *
 * 1. The model never sees the marking weights. It is given the questions and
 *    the answers chosen, not what each option is worth. If it could see the
 *    weights it would re-derive the rule score, the two numbers would agree by
 *    construction, and showing both would tell a manager nothing. Their
 *    disagreement is the whole value — it marks the applications worth a
 *    second look.
 *
 * 2. Nothing here decides anything. The fitment score is stored beside the
 *    rule score; the AI opinion becomes one more reason in a verdict that is
 *    still led by behaviour. No application is auto-declined, ever.
 */

import { pool } from './db.js';
import { askForJson, LlmError, llmMode, llmModel } from './llm.js';
import { extractCvText, CvTextError } from './cvText.js';
import { resolveCv } from './storage.js';
import { ROLE_BY_API_KEY, questionsFor, WRITTEN_QUESTIONS } from './roles.js';
import { isEnabled } from './flags.js';

/**
 * Bumped whenever the wording below changes.
 *
 * Stored against every review, because a score is only defensible if you can
 * say what question produced it. Two applicants reviewed under different
 * prompts are not comparable, and without this nobody could tell.
 */
export const PROMPT_VERSION = 1;

const MAX_ATTEMPTS = Number(process.env.LLM_REVIEW_MAX_ATTEMPTS || 4);
const INTERVAL_MS = Number(process.env.LLM_REVIEW_INTERVAL_MS || 60_000);
const BATCH = Number(process.env.LLM_REVIEW_BATCH || 3);

const SYSTEM = `You assess job applications for a UK law firm and reply only with JSON.

Two things are asked of you, and they are separate judgements. Do not let one
colour the other: a strong candidate may have used AI, and a weak one may not.

FAIRNESS, WHICH MATTERS MORE THAN ANYTHING ELSE HERE.
These roles are remote positions in India and South Africa. Most applicants are
fluent, educated writers for whom English is a second or third language.

  - Judge what is said, never how native it sounds.
  - Correct grammar, formal register and a wide vocabulary are NOT evidence of
    AI. Many applicants write formally because they were taught to, and because
    this is a legal employer.
  - Idiom that reads as slightly translated, or phrasing that is unusual but
    clear, is not a defect and must not lower the fitment score.

WHAT IS ACTUALLY EVIDENCE OF AI ASSISTANCE:
  - answers that do not engage with the specific question asked
  - claims with no personal detail behind them, where the question invited it
  - a register that changes sharply between one answer and the next
  - content that contradicts the CV
Absence of evidence is "unlikely" or "unclear". Say "likely" only when you could
point at something concrete, and say what it is.

Reply with exactly this shape and nothing else:
{
  "fitment_score": <integer 0-100>,
  "fitment_summary": "<one or two sentences a hiring manager can act on>",
  "fitment_reasons": ["<short specific observation>", ...],
  "ai_opinion": "likely" | "unclear" | "unlikely",
  "ai_rationale": "<one or two sentences; name what you saw, or say you saw nothing>"
}`;

/** The application as the model sees it — no weights, no scores, no verdicts. */
export function buildPrompt({ role, writtenAnswers, mcqAnswers, cvText }) {
  const roleMeta = ROLE_BY_API_KEY[role] ?? null;
  const questions = questionsFor(role) ?? [];

  const written = WRITTEN_QUESTIONS.map((q) => {
    const answer = String(writtenAnswers?.[q.id] ?? '').trim();
    return `Q: ${q.label}\nA: ${answer || '(left blank)'}`;
  }).join('\n\n');

  // Chosen labels only. See rule 1 at the top of this file.
  const mcq = questions
    .map((q) => {
      const given = mcqAnswers?.[q.id];
      const picked = (Array.isArray(given) ? given : [given])
        .filter((i) => i !== undefined && i !== null)
        .map((i) => q.options?.[i]?.label)
        .filter(Boolean);
      return `Q: ${q.question}\nChose: ${picked.length ? picked.join('; ') : '(no answer)'}`;
    })
    .join('\n\n');

  return `ROLE: ${roleMeta?.title ?? role}${roleMeta?.country ? ` (remote, ${roleMeta.country})` : ''}

--- THEIR CV ---
${cvText || '(no CV text was available — judge on the answers alone, and say so in the summary)'}

--- WRITTEN ANSWERS ---
${written}

--- MULTIPLE CHOICE ---
${mcq}`;
}

/** A model can return valid JSON of the wrong shape. This is where that stops. */
export function parseReview(parsed) {
  const clampScore = (v) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) throw new LlmError('fitment_score was not a number', { retryable: false });
    return Math.min(100, Math.max(0, n));
  };
  const opinion = String(parsed?.ai_opinion ?? '').toLowerCase();
  return {
    fitmentScore: clampScore(parsed?.fitment_score),
    fitmentSummary: String(parsed?.fitment_summary ?? '').slice(0, 1000) || null,
    fitmentReasons: Array.isArray(parsed?.fitment_reasons)
      ? parsed.fitment_reasons.map((r) => String(r).slice(0, 300)).slice(0, 10)
      : [],
    // Anything unrecognised reads as "unclear" rather than being dropped: an
    // unexpected word must not quietly become a confident verdict.
    aiOpinion: ['likely', 'unclear', 'unlikely'].includes(opinion) ? opinion : 'unclear',
    aiRationale: String(parsed?.ai_rationale ?? '').slice(0, 1000) || null,
  };
}

/** Queues a review. Called when an application is stored; never blocks it. */
export async function queueReview(client, applicantId) {
  await client.query(
    `INSERT INTO recruit_llm_reviews (applicant_id) VALUES ($1)
     ON CONFLICT (applicant_id) DO NOTHING`,
    [applicantId],
  );
}

const CLAIM = `
  SELECT r.applicant_id, r.attempts,
         a.role, a.written_answers, a.mcq_answers, a.cv_object_key,
         a.ai_use_level, a.ai_use_score, a.ai_use_reasons
    FROM recruit_llm_reviews r
    JOIN recruit_applicants a ON a.id = r.applicant_id
   WHERE r.status = 'queued'
     AND r.attempts < $1
     AND r.run_after <= now()
   ORDER BY r.run_after
   LIMIT $2
     FOR UPDATE OF r SKIP LOCKED
`;

/**
 * Folds the model's opinion into the behavioural verdict.
 *
 * Spec §13.3 is why this is worth so little: a text-only judgement about
 * fluent non-native writers is the exact failure mode the behavioural signals
 * exist to avoid. Fifteen points cannot on its own carry a clean application
 * past the 30-point "possible" line — it can only tip one that was already
 * close, and it always says so in the reasons.
 */
export function foldAiOpinion({ level, score, reasons }, { aiOpinion, aiRationale }) {
  if (aiOpinion !== 'likely') return { level, score, reasons };
  const next = Math.min(100, (score ?? 0) + 15);
  return {
    level: next >= 60 ? 'ai_used' : next >= 30 ? 'possible' : 'clean',
    score: next,
    reasons: [...(reasons ?? []), `Model review: ${aiRationale ?? 'reads as AI-assisted'}`],
  };
}

async function reviewOne(row) {
  let cvText = '';
  let cvChars = 0;
  let cvNote = null;

  if (row.cv_object_key) {
    try {
      const extracted = await extractCvText(resolveCv(row.cv_object_key));
      cvText = extracted.text;
      cvChars = extracted.chars;
    } catch (error) {
      // Not fatal. A review from the answers alone is worth more than none,
      // provided it is honest about what it is.
      if (!(error instanceof CvTextError)) throw error;
      cvNote = error.message;
    }
  } else {
    cvNote = 'no CV was uploaded';
  }

  const { parsed, raw } = await askForJson({
    system: SYSTEM,
    prompt: buildPrompt({
      role: row.role,
      writtenAnswers: row.written_answers,
      mcqAnswers: row.mcq_answers,
      cvText,
    }),
  });

  return { review: parseReview(parsed), raw, cvChars, cvNote };
}

/** One pass. Exported so a test — or an admin — can run it without the timer. */
export async function drainReviews() {
  if (llmMode() === 'off') return 0;
  if (!(await isEnabled('recruitment_ai_review'))) return 0;

  const client = await pool.connect();
  let done = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(CLAIM, [MAX_ATTEMPTS, BATCH]);

    for (const row of rows) {
      try {
        const { review, raw, cvChars, cvNote } = await reviewOne(row);

        await client.query(
          `UPDATE recruit_llm_reviews
              SET status = 'done', model = $2, prompt_version = $3,
                  fitment_score = $4, fitment_summary = $5, fitment_reasons = $6::jsonb,
                  ai_opinion = $7, ai_rationale = $8, cv_chars = $9, raw = $10::jsonb,
                  attempts = attempts + 1, last_error = $11,
                  updated_at = now(), completed_at = now()
            WHERE applicant_id = $1`,
          [
            row.applicant_id, llmModel(), PROMPT_VERSION,
            review.fitmentScore, review.fitmentSummary, JSON.stringify(review.fitmentReasons),
            review.aiOpinion, review.aiRationale, cvChars, JSON.stringify(raw), cvNote,
          ],
        );

        // final_score is generated from COALESCE(ai_score, rule_score), so this
        // one write is what promotes the model's number on the dashboard.
        const folded = foldAiOpinion(
          { level: row.ai_use_level, score: row.ai_use_score, reasons: row.ai_use_reasons ?? [] },
          review,
        );
        await client.query(
          `UPDATE recruit_applicants
              SET ai_score = $2, ai_use_level = $3, ai_use_score = $4, ai_use_reasons = $5::jsonb
            WHERE id = $1`,
          [row.applicant_id, review.fitmentScore, folded.level, folded.score, JSON.stringify(folded.reasons)],
        );
        done += 1;
      } catch (error) {
        const permanent = error instanceof LlmError && error.retryable === false;
        const attempts = row.attempts + 1;
        const giveUp = permanent || attempts >= MAX_ATTEMPTS;
        await client.query(
          `UPDATE recruit_llm_reviews
              SET attempts = $2, last_error = $3, updated_at = now(),
                  status = CASE WHEN $4 THEN 'failed' ELSE 'queued' END,
                  run_after = now() + ($5 || ' seconds')::interval,
                  completed_at = CASE WHEN $4 THEN now() ELSE NULL END
            WHERE applicant_id = $1`,
          // Backoff, so a model having a bad ten minutes is not hammered.
          [row.applicant_id, attempts, String(error.message).slice(0, 500), giveUp, 60 * 2 ** attempts],
        );
        console.error(`[fac-recruit] review of ${row.applicant_id} failed: ${error.message}`);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[fac-recruit] review drain failed:', error.message);
  } finally {
    client.release();
  }
  return done;
}

export function startLlmReviewWorker() {
  if (llmMode() === 'off') {
    console.warn('[fac-recruit] no application will be reviewed — OLLAMA_API_KEY is not set');
    return () => {};
  }
  const timer = setInterval(() => {
    drainReviews().catch((error) => console.error('[fac-recruit] review tick failed:', error.message));
  }, INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
