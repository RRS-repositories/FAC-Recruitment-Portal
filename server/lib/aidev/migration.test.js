import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * recruit_017, read as text, as ../sales/migration.test.js reads recruit_016.
 * Nothing here connects to a database; these are the properties that would
 * otherwise only be discovered when the migration is applied to production.
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');
const up = await readFile(path.join(dir, 'recruit_017_aidev_role.sql'), 'utf8');
const down = await readFile(path.join(dir, 'recruit_017_aidev_role_down.sql'), 'utf8');

const code = (sql) =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

test('adds the enum value idempotently, and does nothing else', () => {
  const statements = code(up)
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  assert.deepEqual(statements, ["ALTER TYPE recruit_role ADD VALUE IF NOT EXISTS 'india_aidev'"]);
});

test('never USES the new value in the same transaction it is added in', () => {
  const mentions = code(up).match(/india_aidev/g) ?? [];
  assert.equal(mentions.length, 1);
});

test('the profile column is recruit_016\'s: this file neither adds nor drops it', () => {
  for (const sql of [up, down]) {
    assert.doesNotMatch(code(sql), /ADD COLUMN|DROP COLUMN|ALTER TABLE/i);
  }
});

test('the rollback refuses while AI Developer applications exist, compared as text', () => {
  assert.match(code(down), /RAISE EXCEPTION/);
  assert.match(code(down), /role::text = 'india_aidev'/);
  assert.doesNotMatch(code(down), /role = 'india_aidev'/);
  // There is no DROP VALUE in PostgreSQL; the file must not pretend otherwise.
  assert.doesNotMatch(code(down), /ALTER TYPE/);
  // ...and it says so, for whoever reads it before running it.
  assert.match(down, /has no\s+-- ALTER TYPE \.\.\. DROP VALUE/);
});

test('017 is taken by this file alone, after 016, with its rollback beside it', async () => {
  const files = await readdir(dir);
  assert.deepEqual(files.filter((f) => f.includes('_017_')).sort(), [
    'recruit_017_aidev_role.sql',
    'recruit_017_aidev_role_down.sql',
  ]);
  const forward = files.filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql')).sort();
  assert.equal(forward.indexOf('recruit_017_aidev_role.sql'), forward.indexOf('recruit_016_sales_role.sql') + 1);
});
