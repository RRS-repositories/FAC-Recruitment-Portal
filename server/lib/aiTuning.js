import { pool } from './db.js';
import { DEFAULT_TUNING, readTuning } from '../../shared/aiDetect.js';

/**
 * The tuning the AI-use detector runs on — spec §13.3.
 *
 * Four rows in `recruit_settings` carry it: `ai_use.thresholds`,
 * `ai_use.weights`, `ai_use.limits` and `ai_use.phrases`. They were seeded
 * when the table was created and, until now, nothing read them: the detector
 * ran entirely on the constants compiled into `shared/aiDetect.js`, so the
 * promise that these could be retuned without a deploy was not true. This is
 * the half that makes it true.
 *
 * Reading is the whole job. The folding, the validation and every fallback
 * live in `readTuning`, which is pure and therefore testable without a
 * database — the same split as `flags.js` and `flagPolicy.js`.
 */

/**
 * Cached, for the same reason flags are.
 *
 * Sixty seconds rather than ten: this is read once per submitted application
 * rather than on every public request, and a tuning change is a considered
 * act followed by watching the next batch, not a switch somebody flips and
 * reloads. `__clearAiTuningCache` exists for the tests and for the moment
 * after a write.
 */
const TTL_MS = 60_000;
let cache = { at: 0, value: null };

export async function aiTuning() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;

  try {
    const { rows } = await pool.query('SELECT key, value FROM recruit_settings WHERE key LIKE $1', [
      'ai_use.%',
    ]);

    const value = readTuning(rows);
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    /*
     * Unlike a feature flag, this one fails *open* — on the built-in defaults
     * rather than on nothing.
     *
     * The alternative would be to refuse the application, and an unreadable
     * settings table is not a good enough reason to turn a candidate away.
     * The defaults are the values the detector shipped with and the values
     * the rows currently hold, so the cost of this path is that a retune is
     * not in force for as long as it lasts. Said out loud, because the
     * dashboard will look normal while it is happening.
     */
    console.error(
      '[fac-recruit] could not read ai_use settings, scoring on the built-in defaults:',
      error.message,
    );
    return DEFAULT_TUNING;
  }
}

export const __clearAiTuningCache = () => {
  cache = { at: 0, value: null };
};
