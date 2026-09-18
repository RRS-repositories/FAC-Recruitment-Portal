import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * recruit_016, read as text. Nothing here connects to a database; these are
 * the properties that would otherwise only be discovered when the migration
 * is applied to production, which is the worst place to discover them.
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');
const up = await readFile(path.join(dir, 'recruit_016_sales_role.sql'), 'utf8');
const down = await readFile(path.join(dir, 'recruit_016_sales_role_down.sql'), 'utf8');

const code = (sql) =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

test('adds the enum value idempotently', () => {
  assert.match(code(up), /ALTER TYPE recruit_role ADD VALUE IF NOT EXISTS 'sa_sales';/);
});

test('never USES the new value in the same transaction it is added in', () => {
  // PostgreSQL refuses to use an enum value in the transaction that added it,
  // and the runner applies each file in one transaction. The only mention may
  // be the ADD VALUE itself.
  const mentions = code(up).match(/sa_sales/g) ?? [];
  assert.equal(mentions.length, 1);
});

test('every new column is nullable, has no default, and is IF NOT EXISTS', () => {
  const columns = [...code(up).matchAll(/ADD COLUMN IF NOT EXISTS (\w+)\s+([^,;]+)/g)].map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(columns, [
    ['profile', 'jsonb'],
    ['voice_object_key', 'text'],
    ['voice_filename', 'text'],
    ['voice_mime', 'text'],
    ['voice_size_bytes', 'integer'],
    ['voice_duration_sec', 'integer'],
    ['voice_source', 'text'],
    ['voice_deleted_at', 'timestamptz'],
  ]);
  assert.doesNotMatch(code(up), /DEFAULT|NOT NULL/i);
});

test('every named object starts with recruit_ or idx_recruit_', () => {
  for (const sql of [up, down]) {
    for (const [, name] of code(sql).matchAll(/(?:CONSTRAINT|INDEX)(?: IF (?:NOT )?EXISTS)? (\w+)/gi)) {
      assert.match(name, /^(recruit_|idx_recruit_)/, name);
    }
  }
});

test('voice_source is limited to the two values the API sends', () => {
  assert.match(code(up), /CHECK \(voice_source IS NULL OR voice_source IN \('recorded', 'uploaded'\)\)/);
});

test('the rollback refuses while sales applications exist, and drops every column it added', () => {
  assert.match(code(down), /RAISE EXCEPTION/);
  assert.match(code(down), /role::text = 'sa_sales'/);
  for (const column of [
    'profile',
    'voice_object_key',
    'voice_filename',
    'voice_mime',
    'voice_size_bytes',
    'voice_duration_sec',
    'voice_source',
    'voice_deleted_at',
  ]) {
    assert.match(code(down), new RegExp(`DROP COLUMN IF EXISTS ${column}\\b`), column);
  }
  // There is no DROP VALUE in PostgreSQL; the file must not pretend otherwise.
  assert.doesNotMatch(code(down), /ALTER TYPE/);
});
