import pg from 'pg';

const { Pool } = pg;

/**
 * A missing secret should stop the process starting, not surface as a failed
 * application three days later. Fail loudly at boot.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[fac-recruit] Missing required environment variable ${name}. See server/.env.example`);
  }
  return value;
}

export const pool = new Pool({
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
pool.on('error', (error) => console.error('[fac-recruit] idle client error:', error.message));

export async function assertConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db');
  console.log(`[fac-recruit] connected to ${rows[0].db}`);
  return rows[0];
}

export default pool;
