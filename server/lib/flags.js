import { pool } from './db.js';
import { FLAGS, flagKey, readFlags } from './flagPolicy.js';

/**
 * Feature flags — spec §2.
 *
 *   recruitment_portal   the public application pages and submission
 *   recruitment_booking  candidate self-service booking
 *   recruitment_alerts   anything that reaches a real person (email today,
 *                        the interviewer alert when it exists)
 *
 * All three default to OFF, and that default is load-bearing rather than
 * cautious: it is what lets the whole thing be deployed and watched before
 * anybody outside the firm can reach it. A missing row, an unreachable
 * database, a typo in a key — every one of those reads as OFF.
 *
 * They live in `recruit_settings` rather than the environment so they can be
 * flipped without a deploy, which is the entire point of a flag.
 */

export { FLAGS } from './flagPolicy.js';

/**
 * Cached for a few seconds.
 *
 * Every public request checks a flag, and none of them should cost a query.
 * Ten seconds is chosen from the other side: a manager who flips a switch and
 * reloads must see it take effect, and nobody minds waiting ten seconds.
 */
const TTL_MS = 10_000;
let cache = { at: 0, values: null };

async function readAll() {
  if (cache.values && Date.now() - cache.at < TTL_MS) return cache.values;

  try {
    const { rows } = await pool.query('SELECT key, value FROM recruit_settings WHERE key LIKE $1', [
      'flags.%',
    ]);

    // Anything not exactly `true` reads as OFF — see flagPolicy.js.
    const values = readFlags(rows);

    cache = { at: Date.now(), values };
    return values;
  } catch (error) {
    // A database that cannot be read is not a reason to serve the public
    // portal. Fail closed, and say why — loudly, because everything will
    // look switched off.
    console.error('[fac-recruit] could not read feature flags, treating all as OFF:', error.message);
    return Object.fromEntries(FLAGS.map((name) => [name, false]));
  }
}

export const allFlags = () => readAll();

export async function isEnabled(name) {
  const values = await readAll();
  return values[name] === true;
}

/** Flips one flag. Returns the new value. */
export async function setFlag(name, enabled) {
  if (!FLAGS.includes(name)) throw new Error(`unknown flag: ${name}`);

  await pool.query(
    `INSERT INTO recruit_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [flagKey(name), JSON.stringify(Boolean(enabled))],
  );

  cache = { at: 0, values: null }; // so the next read is the truth, not the cache
  return Boolean(enabled);
}

/**
 * Express middleware. Closes a whole route group behind one flag.
 *
 * 503 rather than 404: the feature exists and is switched off, which is what
 * a monitor and a human both need to be told. The wording is the candidate's,
 * though — they do not need to hear the word "flag".
 */
export function requireFlag(name, message) {
  return async (_req, res, next) => {
    if (await isEnabled(name)) return next();
    return res.status(503).json({
      ok: false,
      error: message ?? 'This is not open yet. Please check back shortly.',
      disabled: true,
    });
  };
}

/** Only for tests, and for the moment after a flag is written. */
export const __clearFlagCache = () => {
  cache = { at: 0, values: null };
};
