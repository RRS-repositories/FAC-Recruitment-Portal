#!/usr/bin/env node
import 'dotenv/config';
import { pool } from '../lib/db.js';
import { aiTuning } from '../lib/aiTuning.js';
import { detectAiUse } from '../../shared/aiDetect.js';
import { foldAiOpinion } from '../lib/llmReview.js';

/**
 * Re-decides every stored AI verdict under the current rule.
 *
 * Needed once, because the rule changed: "AI used" now requires the model and
 * the machine to agree, and applications labelled under the old
 * behaviour-only rule are still carrying that label. Leaving them would mean
 * the dashboard goes on accusing people the model has already cleared.
 *
 * It recomputes rather than patches: the behavioural pass is re-run from the
 * written answers and telemetry that were stored, the model's opinion is read
 * from the review that was already done, and the two are folded exactly as a
 * live review folds them. So it cannot invent a verdict a fresh application
 * would not have received.
 *
 * Nothing is sent, nothing is queued, no review is re-run against the model.
 * Only `ai_use_level`, `ai_use_score` and `ai_use_reasons` are written.
 *
 *   node scripts/backfill-ai-verdicts.js             # dry run, prints the change
 *   node scripts/backfill-ai-verdicts.js --write     # applies it
 */

const WRITE = process.argv.includes('--write');

const READ = `
  SELECT a.id, a.written_answers, a.telemetry,
         a.ai_use_level, a.ai_use_score,
         r.ai_opinion, r.ai_rationale, r.status AS review_status
    FROM recruit_applicants a
    LEFT JOIN recruit_llm_reviews r ON r.applicant_id = a.id
   ORDER BY a.created_at
`;

const tally = (rows, key) =>
  rows.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] ?? 0) + 1 }), {});

async function main() {
  const tuning = await aiTuning();
  const { rows } = await pool.query(READ);

  const planned = rows.map((row) => {
    const behaviour = detectAiUse(row.written_answers, row.telemetry ?? {}, tuning);

    // A review that has not finished has no opinion to fold, and must not be
    // treated as though the model had said "unlikely" — it has said nothing.
    const reviewed = row.review_status === 'done' && row.ai_opinion;
    const next = reviewed
      ? foldAiOpinion(behaviour, { aiOpinion: row.ai_opinion, aiRationale: row.ai_rationale }, tuning)
      : behaviour;

    return {
      id: row.id,
      from: row.ai_use_level,
      to: next.level,
      fromScore: row.ai_use_score,
      toScore: next.score,
      reasons: next.reasons,
      changed: next.level !== row.ai_use_level || next.score !== row.ai_use_score,
    };
  });

  const changed = planned.filter((p) => p.changed);

  console.log(`applicants:       ${planned.length}`);
  console.log(`before:           ${JSON.stringify(tally(planned, 'from'))}`);
  console.log(`after:            ${JSON.stringify(tally(planned, 'to'))}`);
  console.log(`rows to change:   ${changed.length}`);

  const moves = {};
  for (const p of changed) {
    const key = `${p.from} -> ${p.to}`;
    moves[key] = (moves[key] ?? 0) + 1;
  }
  for (const [move, n] of Object.entries(moves).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${move.padEnd(24)} ${n}`);
  }

  if (!WRITE) {
    console.log('\nDRY RUN — nothing written. Re-run with --write to apply.');
    await pool.end();
    return;
  }

  // One transaction: a half-applied backfill would leave the dashboard
  // showing two different rules at once, which is worse than either.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of changed) {
      await client.query(
        `UPDATE recruit_applicants
            SET ai_use_level = $2, ai_use_score = $3, ai_use_reasons = $4::jsonb
          WHERE id = $1`,
        [p.id, p.to, p.toScore, JSON.stringify(p.reasons)],
      );
    }
    await client.query('COMMIT');
    console.log(`\nWROTE ${changed.length} rows.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('backfill failed, nothing written:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
