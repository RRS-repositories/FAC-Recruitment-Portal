import { pool } from './db.js';
import { deleteCv } from './storage.js';

/**
 * Deleting CVs we are no longer entitled to keep — spec §12.
 *
 * This is the only code in the portal that destroys anything on purpose, so
 * it is written to be boring and to be checkable before it runs:
 *
 *   · It only ever touches DECLINED applicants, and only their CV file —
 *     plus, for a Sales applicant, the voice note that came with it, which
 *     is the same kind of personal data and goes at the same moment.
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

/*
 * The voice-note columns are read through to_jsonb, not by name: this query
 * runs for every role, and recruit_016 adds them. Named directly, a deploy
 * that reached the server before its migration would stop CV deletion too.
 * Through to_jsonb a missing column is NULL, and a NULL key means "no voice
 * note", which is exactly true of a database that has never had one.
 */
const DUE = `
  SELECT a.id, a.email, a.cv_object_key, a.cv_filename, a.decided_at,
         to_jsonb(a) ->> 'voice_object_key' AS voice_object_key,
         to_jsonb(a) ->> 'voice_filename'   AS voice_filename
    FROM recruit_applicants a
   WHERE a.status = 'declined'
     AND a.cv_object_key IS NOT NULL
     AND a.cv_deleted_at IS NULL
     AND a.decided_at < now() - ($1 || ' months')::interval
   ORDER BY a.decided_at
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
 *
 * A voice note, where there is one, follows its CV through exactly the same
 * steps in the same transaction. Its UPDATE names the new columns directly,
 * and that is safe: it only runs for a row whose voice key was read back
 * non-null, which a database without those columns cannot produce.
 */
export async function sweepExpiredCvs({ dryRun = false } = {}) {
  const { months, due } = await dueForDeletion();
  const summary = { months, considered: due.length, deleted: 0, missing: 0, dryRun };
  // Counted apart from the CVs, so the CV numbers mean what they always have.
  const voice = { deleted: 0, missing: 0 };

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

      if (row.voice_object_key) {
        await client.query(
          `UPDATE recruit_applicants
              SET voice_deleted_at = now(), voice_object_key = NULL
            WHERE id = $1`,
          [row.id],
        );
      }

      // Written before the file goes, so the record of the deletion cannot be
      // lost by a crash a moment later. `actor_email` stays null: this is the
      // system acting on a policy, not a person making a decision.
      await client.query(
        `INSERT INTO recruit_audit (applicant_id, action, payload)
         VALUES ($1, 'cv_deleted', $2)`,
        [
          row.id,
          JSON.stringify({
            reason: 'retention',
            months,
            filename: row.cv_filename,
            // Present only when a voice note went too, so a CV-only deletion
            // is recorded exactly as it always has been.
            ...(row.voice_object_key ? { voiceFilename: row.voice_filename ?? null } : {}),
          }),
        ],
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

    if (row.voice_object_key) {
      // deleteCv removes any key under the private root; the voice note lives
      // beside the CV, so the same guarded unlink serves both.
      if (await deleteCv(row.voice_object_key)) voice.deleted += 1;
      else voice.missing += 1;
    }
  }

  console.log(
    `[fac-recruit] retention: deleted ${summary.deleted} CV(s) declined over ${months} months ago` +
      (summary.missing ? `, ${summary.missing} already gone from disk` : ''),
  );
  if (voice.deleted || voice.missing) {
    summary.voiceDeleted = voice.deleted;
    summary.voiceMissing = voice.missing;
    console.log(
      `[fac-recruit] retention: deleted ${voice.deleted} voice note(s) with them` +
        (voice.missing ? `, ${voice.missing} already gone from disk` : ''),
    );
  }
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
