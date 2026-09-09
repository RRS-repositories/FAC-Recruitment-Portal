import pg from 'pg';

const { Pool } = pg;

/**
 * The database connection, which may not be ours.
 *
 * This module has two lives. Run standalone, it builds its own pool from the
 * PG* environment variables, exactly as before. Mounted inside another Express
 * app — the CRM — it is handed that app's pool at boot and uses it instead, so
 * recruitment shares one set of connections with everything else rather than
 * opening a second.
 *
 * WHY A PROXY RATHER THAN PASSING THE POOL AROUND. Eleven modules import
 * `pool` from here and call it across fifty sites. Threading an injected pool
 * through all of them would be a large diff through working code, for no gain:
 * the binding they import can simply forward to whichever pool is current. So
 * `pool` is a stable object that delegates, `adoptPool` says which one to
 * delegate to, and not one of those eleven files has to change.
 *
 * The second benefit is that nothing connects — or even reads PG* — until the
 * first query. Importing a module for its pure functions no longer demands a
 * configured database, which is what used to make `hash-password.js` fail on a
 * machine that had not been set up yet.
 */

/**
 * A missing secret should stop the process starting, not surface as a failed
 * application three days later. Fail loudly, but only when we are the ones
 * connecting: a host that hands us its pool never reads these at all.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[fac-recruit] Missing required environment variable ${name}. See server/.env.example`);
  }
  return value;
}

function createOwnPool() {
  const own = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    database: required('PGDATABASE'),
    user: required('PGUSER'),
    password: required('PGPASSWORD'),
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // An idle client erroring must not take a public endpoint down over a blip.
  own.on('error', (error) => console.error('[fac-recruit] idle client error:', error.message));
  return own;
}

/** Whose pool we are using, and whether we are the ones who must close it. */
const state = { pool: null, owned: false };

function active() {
  if (!state.pool) {
    state.pool = createOwnPool();
    state.owned = true;
  }
  return state.pool;
}

/**
 * Use the host application's pool.
 *
 * Called once, before anything queries. Refuses to swap a pool that is already
 * in use: half the process talking to one database and half to another is the
 * kind of fault that shows up as data appearing to vanish.
 */
export function adoptPool(external) {
  if (!external) throw new Error('[fac-recruit] adoptPool needs a pg Pool.');
  if (state.pool && state.pool !== external) {
    throw new Error('[fac-recruit] a database pool is already in use; adoptPool must be called before the first query.');
  }
  state.pool = external;
  state.owned = false;
  return external;
}

/** True when this process built the pool, so it is ours to close. */
export const ownsPool = () => state.owned;

/**
 * The pool, as every other module sees it.
 *
 * Delegates to whichever pool is current. Methods are bound to that pool so
 * `pool.query(...)` and `pool.connect()` behave exactly as they did when this
 * was a plain Pool instance.
 */
export const pool = new Proxy(
  {},
  {
    get(_target, property) {
      const real = active();
      const value = real[property];
      return typeof value === 'function' ? value.bind(real) : value;
    },
    set(_target, property, value) {
      active()[property] = value;
      return true;
    },
    has: (_target, property) => property in active(),
  },
);

export async function assertConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db');
  console.log(`[fac-recruit] connected to ${rows[0].db}`);
  return rows[0];
}

export default pool;
