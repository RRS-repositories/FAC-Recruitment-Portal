import pkg from 'pg';

const { Pool } = pkg;

/**
 * Fails loudly at startup rather than at the first request.
 *
 * A missing secret that only surfaces when a visitor submits the form is a
 * silently lost enquiry; a missing secret that stops the process from booting
 * is a deploy that obviously failed. Prefer the second.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[atlas-intake] Missing required environment variable ${name}. ` +
        'See server/.env.example — the service will not start without it.',
    );
  }
  return value;
}

const host = process.env.ATLAS_DB_HOST || '127.0.0.1';
const port = Number(process.env.ATLAS_DB_PORT || 5434);

// A guard, not a nicety: pointing this service at 5432 would aim it at the CRM
// cluster, which is the one thing this whole design exists to prevent.
if (port === 5432) {
  throw new Error(
    '[atlas-intake] ATLAS_DB_PORT is 5432, which is the CRM cluster. ' +
      'The Atlas cluster is 5434. Refusing to start.',
  );
}

export const pool = new Pool({
  host,
  port,
  user: required('ATLAS_DB_USER'),
  password: required('ATLAS_DB_PASSWORD'),
  database: required('ATLAS_DB_NAME'),
  // Local cluster over the loopback interface: TLS buys nothing here and the
  // cluster is not configured for it. Set ATLAS_DB_SSL=true if that changes.
  ssl: process.env.ATLAS_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.ATLAS_DB_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// An idle client erroring must not take the process down — pm2 would restart a
// public endpoint over a transient database blip.
pool.on('error', (error) => {
  console.error('[atlas-intake] idle client error:', error.message);
});

/** Verifies the connection at boot so a misconfiguration is obvious. */
export async function assertConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db, inet_server_port() AS port');
  console.log(`[atlas-intake] connected to ${rows[0].db} on port ${rows[0].port}`);
  return rows[0];
}

export default pool;
