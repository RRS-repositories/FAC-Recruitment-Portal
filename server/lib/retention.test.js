import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The retention sweep, against a fake database and a throwaway storage root.
 *
 * What is pinned: a declined applicant with only a CV is handled exactly as it
 * always was (same statements, same audit payload, same summary), and one with
 * a voice note loses both files in the same pass. Nothing here touches a real
 * database or a real CV directory.
 */

// storage.js reads CV_STORAGE_DIR once, at import, so it is set first and the
// modules are imported after.
const ROOT = await mkdtemp(path.join(tmpdir(), 'fac-retention-'));
process.env.CV_STORAGE_DIR = ROOT;
const { adoptPool } = await import('./db.js');
const { sweepExpiredCvs } = await import('./retention.js');

/** A pool that answers the sweep's reads and records every statement. */
function fakePool(due) {
  const statements = [];
  const record = async (sql, params = []) => {
    statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    if (/FROM recruit_settings/.test(sql)) return { rows: [{ value: 6 }] };
    if (/FROM recruit_applicants/.test(sql) && /status = 'declined'/.test(sql)) return { rows: due };
    return { rows: [] };
  };
  return {
    statements,
    query: record,
    connect: async () => ({ query: record, release() {} }),
  };
}

const db = fakePool([]);
adoptPool(db);

async function put(key) {
  await mkdir(path.dirname(path.join(ROOT, key)), { recursive: true });
  await writeFile(path.join(ROOT, key), 'x');
}
const exists = (key) => stat(path.join(ROOT, key)).then(() => true, () => false);

test.after(() => rm(ROOT, { recursive: true, force: true }));

test('the due query reads voice columns through to_jsonb, so it runs before recruit_016', async () => {
  db.statements.length = 0;
  await sweepExpiredCvs({ dryRun: true });
  const due = db.statements.find((s) => /status = 'declined'/.test(s.sql));
  assert.ok(due, 'the due query ran');
  assert.match(due.sql, /to_jsonb\(a\) ->> 'voice_object_key'/);
  assert.doesNotMatch(due.sql, /\ba\.voice_/, 'no voice column is named directly');
});

test('a CV-only applicant is swept exactly as before, and no voice statement runs', async () => {
  await put('aaaa/cv.pdf');
  const rows = [
    { id: 'aaaa', email: 'a@example.com', cv_object_key: 'aaaa/cv.pdf', cv_filename: 'cv.pdf', voice_object_key: null, voice_filename: null },
  ];
  db.statements.length = 0;
  db.query = fakePool(rows).query;
  const writes = [];
  db.connect = async () => ({
    query: async (sql, params) => {
      writes.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return { rows: [] };
    },
    release() {},
  });

  const summary = await sweepExpiredCvs();

  assert.deepEqual(summary, { months: 6, considered: 1, deleted: 1, missing: 0, dryRun: false });
  assert.equal(await exists('aaaa/cv.pdf'), false);
  assert.ok(writes.every((w) => !/voice/.test(w.sql)), 'nothing mentions a voice column');
  const audit = writes.find((w) => /recruit_audit/.test(w.sql));
  assert.deepEqual(JSON.parse(audit.params[1]), { reason: 'retention', months: 6, filename: 'cv.pdf' });
});

test('a voice note goes with its CV, in the same transaction', async () => {
  await put('bbbb/cv.pdf');
  await put('bbbb/voice.webm');
  const rows = [
    { id: 'bbbb', email: 'b@example.com', cv_object_key: 'bbbb/cv.pdf', cv_filename: 'cv.pdf', voice_object_key: 'bbbb/voice.webm', voice_filename: 'note.webm' },
  ];
  db.query = fakePool(rows).query;
  const writes = [];
  db.connect = async () => ({
    query: async (sql, params) => {
      writes.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return { rows: [] };
    },
    release() {},
  });

  const summary = await sweepExpiredCvs();

  assert.equal(summary.deleted, 1);
  assert.equal(summary.voiceDeleted, 1);
  assert.equal(summary.voiceMissing, 0);
  assert.equal(await exists('bbbb/cv.pdf'), false);
  assert.equal(await exists('bbbb/voice.webm'), false);

  const sqls = writes.map((w) => w.sql);
  const begin = sqls.indexOf('BEGIN');
  const commit = sqls.indexOf('COMMIT');
  const voiceUpdate = sqls.findIndex((s) => /SET voice_deleted_at = now\(\), voice_object_key = NULL/.test(s));
  assert.ok(begin < voiceUpdate && voiceUpdate < commit, 'the voice update is inside the transaction');
  const audit = writes.find((w) => /recruit_audit/.test(w.sql));
  assert.deepEqual(JSON.parse(audit.params[1]), {
    reason: 'retention',
    months: 6,
    filename: 'cv.pdf',
    voiceFilename: 'note.webm',
  });
});

test('a voice note already gone from disk is counted, not fatal', async () => {
  await put('cccc/cv.pdf');
  const rows = [
    { id: 'cccc', email: 'c@example.com', cv_object_key: 'cccc/cv.pdf', cv_filename: 'cv.pdf', voice_object_key: 'cccc/voice.webm', voice_filename: 'n.webm' },
  ];
  db.query = fakePool(rows).query;
  db.connect = async () => ({ query: async () => ({ rows: [] }), release() {} });

  const summary = await sweepExpiredCvs();
  assert.equal(summary.deleted, 1);
  assert.equal(summary.voiceDeleted, 0);
  assert.equal(summary.voiceMissing, 1);
});
