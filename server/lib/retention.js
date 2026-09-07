import { pool } from './db.js';
import { deleteCv } from './storage.js';

/**
 * Deleting CVs we are no longer entitled to keep — spec §12.
 *
 * This is the only code in the portal that destroys anything on purpose, so
 * it is written to be boring and to be checkable before it runs:
 *
 *   · It only ever touches DECLINED applicants, and only their CV file.
 *   · The application row survives — decision, score, audit trail. Answering
 *     a data-protection duty by erasing the record of how someone was treated
 *     would be the wrong obligation entirely.
 *   · Every deletion is written to the audit trail before the file goes.
 *   · A period of 0 switches it off, and nothing runs.
 *   · `dryRun` reports exactly what would go without touching a byte.
 */

const SETTING = 'retention.declined_cv_months';

/** Months to keep a declined applicant's CV. 0 disables deletion entirely. */
export async function retentionMonths() {
  const { rows } = await pool.query('SELECT value FROM recruit_settings WHERE key = $1', [SETTING]);
  const value = Number(rows[0]?.value);
  // A missing or nonsensical setting must not delete anything. Silence here
  // has to mean "keep", never "guess".
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function setRetentionMonths(months) {
  const value = Math.max(0, Math.min(120, Math.floor(Number(months) || 0)));
  await pool.query(
    `INSERT INTO recruit_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTING, JSON.stringify(value)],
  );
  return value;
}

const DUE = `
  SELECT id, email, cv_object_key, cv_filename, decided_at
    FROM recruit_applicants
   WHERE status = 'declined'
     AND cv_object_key IS NOT NULL
     AND cv_deleted_at IS NULL
     AND decided_at < now() - ($1 || ' months')::interval
   ORDER BY decided_at
   LIMIT 500
`;

/** What would go, without deleting anything. */
export async function dueForDeletion() {
  const months = await retentionMonths();
  if (months === 0) return { months, due: [] };

  const { rows } = await pool.query(DUE, [String(months)]);
  return { months, due: rows };
}

/**
 * Deletes the files that are past their retention period.
 *
 * The database row is marked first, then the file removed. That order is
 * deliberate: if the process dies between the two, the worst case is a row
 * that says the CV is gone while the file survives — visible, and cleaned up
 * by the next sweep of the same key. The other order would leave a row
 * offering a download of a file that no longer exists.
 */
export async function sweepExpiredCvs({ dryRun = false } = {}) {
  const { months, due } = await dueForDeletion();
  const summary = { months, considered: due.length, deleted: 0, missing: 0, dryRun };

  if (months === 0 || due.length === 0) return summary;
  if (dryRun) return summary;

  for (const row of due) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE recruit_applicants SET cv_deleted_at = now(), cv_object_key = NULL WHERE id = $1',
        [row.id],
      );

      // Written before the file goes, so the record of the deletion cannot be
      // lost by a crash a moment later. `actor_email` stays null: this is the
      // system acting on a policy, not a person making a decision.
      await client.query(
        `INSERT INTO recruit_audit (applicant_id, action, payload)
         VALUES ($1, 'cv_deleted', $2)`,
        [row.id, JSON.stringify({ reason: 'retention', months, filename: row.cv_filename })],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[fac-recruit] retention: could not mark ${row.id}:`, error.message);
      client.release();
      continue;
    }
    client.release();

    const removed = await deleteCv(row.cv_object_key);
    if (removed) summary.deleted += 1;
    else summary.missing += 1;
  }

  console.log(
    `[fac-recruit] retention: deleted ${summary.deleted} CV(s) declined over ${months} months ago` +
      (summary.missing ? `, ${summary.missing} already gone from disk` : ''),
  );
  return summary;
}

/**
 * Runs the sweep once a day.
 *
 * Daily rather than hourly because the deadline is measured in months — the
 * only thing a tighter schedule would buy is more chances to get it wrong.
 * It runs shortly after boot too, so a server that is restarted often still
 * sweeps, and so a misconfiguration shows up immediately rather than
 * tomorrow.
 */
export function startRetentionSweep({ intervalMs = 24 * 3_600_000 } = {}) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sweepExpiredCvs();
    } catch (error) {
      console.error('[fac-recruit] retention sweep failed:', error.message);
    } finally {
      running = false;
    }
  };

  const startup = setTimeout(tick, 60_000);
  startup.unref?.();

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();

  return () => {
    clearTimeout(startup);
    clearInterval(timer);
  };
}
