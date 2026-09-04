import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../db.mjs';

/**
 * Applies pending migrations against the Atlas cluster and records each one in
 * a `schema_migrations` ledger, so re-running is a no-op.
 *
 * Same shape as the `scripts/apply-*-migrations.mjs` runners in CRM-Finalised.
 * House rule: Claude writes migrations, Brad runs this.
 *
 *   node server/scripts/apply-migrations.mjs           # apply pending
 *   node server/scripts/apply-migrations.mjs --dry-run # list, change nothing
 *
 * `_down.sql` files are never picked up — rolling back is a deliberate manual
 * act, not something a runner should do because a file happened to be present.
 */

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const dryRun = process.argv.includes('--dry-run');

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

async function main() {
  const { rows: where } = await pool.query(
    'SELECT current_database() AS db, inet_server_port() AS port',
  );
  const { db, port } = where[0];

  // The whole isolation guarantee rests on this not being the CRM cluster.
  if (Number(port) === 5432) {
    throw new Error(`Refusing to run: port ${port} is the CRM cluster, not Atlas (5434).`);
  }
  console.log(`Target: ${db} on port ${port}${dryRun ? '  [dry run]' : ''}`);

  await pool.query(LEDGER);
  const { rows: done } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(done.map((r) => r.filename));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'))
    .sort();

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('Nothing to apply — all migrations are already recorded.');
    return;
  }

  for (const file of pending) {
    if (dryRun) {
      console.log(`  would apply  ${file}`);
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      // Each migration is one transaction: it applies completely or not at all,
      // and the ledger entry commits with it so the two cannot disagree.
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  applied      ${file}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  FAILED       ${file}\n               ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(`\n${error.message}`);
    await pool.end().catch(() => {});
    process.exit(1);
  });
