import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

/**
 * Applies pending migrations and records each in a `schema_migrations` ledger,
 * so re-running is a no-op. Same convention as CRM-Finalised's
 * `scripts/apply-*-migrations.mjs`.
 *
 *   node scripts/apply-migrations.js            # apply pending
 *   node scripts/apply-migrations.js --dry-run  # list, change nothing
 *   node scripts/apply-migrations.js --down 003 # roll one back, deliberately
 *
 * House rule: Claude writes migrations, Brad applies them. Nothing here runs
 * on its own.
 *
 * `_down.sql` files are never picked up by a normal run — rolling back is an
 * explicit act with an explicit argument, not something that happens because a
 * file exists.
 */

const { Pool } = pg;
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const dryRun = process.argv.includes('--dry-run');
const downIndex = process.argv.indexOf('--down');
const downTarget = downIndex !== -1 ? process.argv[downIndex + 1] : null;

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

/**
 * Migrations that grant privileges need the application role's name. psql
 * would expand `:"app_role"`; node-postgres has no such feature, so the
 * substitution happens here from PGUSER — one source of truth, and no role
 * name hardcoded in a committed file.
 */
function substituteRole(sql, roleName) {
  if (!sql.includes(':"app_role"')) return sql;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(roleName)) {
    throw new Error(
      `PGUSER "${roleName}" is not a plain identifier. Refusing to interpolate it into SQL.`,
    );
  }
  return sql.replaceAll(':"app_role"', `"${roleName}"`);
}

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    // Migrations need privileges the app role does not have (CREATE EXTENSION,
    // GRANT), so they run as an admin user when one is supplied.
    user: process.env.PGADMINUSER || process.env.PGUSER,
    password: process.env.PGADMINPASSWORD || process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const appRole = process.env.PGUSER;
  const { rows: where } = await pool.query(
    'SELECT current_database() AS db, current_user AS who',
  );
  console.log(
    `Target: ${where[0].db} as ${where[0].who}` +
      `${dryRun ? '  [dry run]' : ''}${downTarget ? `  [rolling back ${downTarget}]` : ''}`,
  );

  await pool.query(LEDGER);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql'));

  // ── Rollback ──────────────────────────────────────────────────────────────
  if (downTarget) {
    const down = files.find((f) => f.includes(`_${downTarget}_`) && f.endsWith('_down.sql'));
    if (!down) throw new Error(`No _down.sql found matching "${downTarget}"`);

    const sql = substituteRole(await readFile(path.join(MIGRATIONS_DIR, down), 'utf8'), appRole);
    const forward = down.replace('_down.sql', '.sql');

    // Rolling back out of order silently desynchronises the ledger from
    // reality. Rolling back 001 drops the tables 003 seeded, but 003's ledger
    // row survives — so the next deploy skips the seed and the portal comes up
    // with no interviewer and no availability rules, showing every candidate
    // zero slots with nothing visibly broken. Refuse instead.
    const { rows: stillApplied } = await pool.query(
      'SELECT filename FROM schema_migrations WHERE filename > $1 ORDER BY filename',
      [forward],
    );
    if (stillApplied.length > 0) {
      throw new Error(
        `Refusing to roll back ${forward} while later migrations are still applied:\n` +
          stillApplied.map((r) => `    ${r.filename}`).join('\n') +
          `\n  Roll those back first, newest first.`,
      );
    }

    if (dryRun) {
      console.log(`  would roll back  ${down}`);
    } else {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('DELETE FROM schema_migrations WHERE filename = $1', [forward]);
        await client.query('COMMIT');
        console.log(`  rolled back      ${down}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
    await pool.end();
    return;
  }

  // ── Forward ───────────────────────────────────────────────────────────────
  const { rows: done } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(done.map((r) => r.filename));

  const pending = files
    .filter((f) => !f.endsWith('_down.sql'))
    .sort()
    .filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('Nothing to apply — all migrations are already recorded.');
    await pool.end();
    return;
  }

  for (const file of pending) {
    if (dryRun) {
      console.log(`  would apply      ${file}`);
      continue;
    }

    const sql = substituteRole(await readFile(path.join(MIGRATIONS_DIR, file), 'utf8'), appRole);
    const client = await pool.connect();
    try {
      // One transaction per migration: it applies completely or not at all,
      // and the ledger entry commits with it so the two cannot disagree.
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  applied          ${file}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  FAILED           ${file}\n                   ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
