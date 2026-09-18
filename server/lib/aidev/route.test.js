import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * POST /applications/ai-developer, end to end, with no database -- the same
 * harness as ../sales/route.test.js: the real router (multer, rate limiter,
 * validation, scoring, AI detection, the transaction, the CV on disk) against
 * a stand-in pool that records every statement.
 *
 * Isolation: files go to a throwaway directory, the captcha and SMTP settings
 * are cleared so nothing reaches the network, and the listener is on an
 * ephemeral loopback port for the life of this file only. Nothing is sent:
 * the route only ever queues email, and the queue here is a recorded query.
 */
const root = await mkdtemp(path.join(os.tmpdir(), 'fac-aidev-route-test-'));
process.env.CV_STORAGE_DIR = root;
process.env.APPLY_RATE_MAX = '1000';
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.SMTP_HOST;

const { default: express } = await import('express');
const { adoptPool } = await import('../db.js');

const APPLICANT = '11111111-2222-4333-8444-555555555555';
const SESSION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

let log = [];
let mode = {};
const flat = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const client = {
  async query(sql, params = []) {
    const s = flat(sql);
    log.push({ sql: s, params });
    if (mode.failOn && s.startsWith(mode.failOn)) throw Object.assign(new Error('boom'), { code: 'XX000' });
    if (s.includes('key LIKE $1') && params[0] === 'flags.%') {
      return { rows: [{ key: 'flags.recruitment_portal', value: true }] };
    }
    if (s.includes('key LIKE $1')) return { rows: [] };
    if (s.includes('FROM recruit_sessions s JOIN')) {
      return { rows: mode.resent ? [{ id: APPLICANT, email: 'a@example.com', role: mode.resent, decided_by_email: null }] : [] };
    }
    if (s.startsWith('SELECT started_at')) return { rows: [{ started_at: new Date(Date.now() - 600_000) }] };
    if (s.includes("'do_not_rehire_reason' AS reason")) return { rows: mode.barred ? [{ reason: 'Test reason' }] : [] };
    if (s.startsWith('INSERT INTO recruit_applicants')) {
      if (mode.insertError) throw Object.assign(new Error('boom'), { code: mode.insertError });
      return { rows: [{ id: APPLICANT, created_at: new Date(), full_name: params[1], email: params[2] }] };
    }
    if (s.startsWith('INSERT INTO recruit_outbox')) return { rows: [{ id: 1 }] };
    return { rows: [], rowCount: 1 };
  },
  release() {},
};
adoptPool({ query: (...args) => client.query(...args), connect: async () => client });

const { createApplicationsRouter } = await import('../../routes/applications.js');

let hostErrors = [];
const app = express();
app.use(express.json());
app.use('/applications', createApplicationsRouter({ ipSalt: 'test-salt' }));
app.use((error, _req, res, _next) => {
  hostErrors.push(error);
  res.status(500).json({ ok: false, error: 'Something went wrong at our end.' });
});

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/applications`;
const aidev = `${base}/ai-developer`;
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

// ── Fixtures (invented; no real person) ─────────────────────────────────────

const MB = 1024 * 1024;
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 0x20)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]), Buffer.from('webm'), Buffer.alloc(200)]);

const BEST = {
  q1: 0, q2: 0, q3: [0, 1, 3], q4: 0, q5: 0, q6: 0,
  q7: 0, q8: [0, 1, 2, 3, 4, 5, 6, 7], q9: 0, q10: 0, q11: 0, q12: 0,
};
const WRITTEN = Object.fromEntries(
  ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'].map((id) => [id, `An answer for ${id}, written plainly, about a small system I built and then had to fix.`]),
);
// In profileForStorage's key order, so the stored JSON can be compared as a
// string.
const PROFILE = {
  city: 'Testville',
  qualification: 'MCA / M.Tech',
  experience: '3–5 years',
  githubUrl: 'https://github.com/example',
  employer: 'Example Ltd',
  heardFrom: 'Naukri',
  noticePeriod: '1 month',
};

function aidevForm(over = {}, { cv = { buffer: PDF, name: 'cv.pdf' }, extra = [] } = {}) {
  const form = new FormData();
  const fields = {
    role: 'ai-developer',
    fullName: 'Test Person',
    email: 'a@example.com',
    phone: '+00 0000 000000',
    ...PROFILE,
    written: JSON.stringify(WRITTEN),
    answers: JSON.stringify(BEST),
    telemetry: '{}',
    sessionId: SESSION,
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value);
  if (cv) form.append('cv', new Blob([cv.buffer]), cv.name);
  for (const [field, buffer, name] of extra) form.append(field, new Blob([buffer]), name);
  return form;
}

async function post(url, body, withMode = {}) {
  mode = withMode;
  log = [];
  hostErrors = [];
  const response = await fetch(url, { method: 'POST', body });
  return { status: response.status, body: await response.json(), log, hostErrors };
}

const statements = (entries) => entries.map((e) => e.sql.slice(0, 40));
const filesOnDisk = async () => {
  try {
    return (await readdir(path.join(root, APPLICANT))).sort();
  } catch {
    return [];
  }
};
const clearDisk = () => rm(path.join(root, APPLICANT), { recursive: true, force: true });

const UNKNOWN_ROLE = { ok: false, error: 'Unknown role.' };
const UNREADABLE = { ok: false, error: 'Could not read that submission.' };

// ── A valid application ─────────────────────────────────────────────────────

test('a valid application stores the CV and the profile, scored on the server', async () => {
  const result = await post(aidev, aidevForm());
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { ok: true, id: APPLICANT, acknowledged: false });

  const fromResend = result.log.slice(result.log.findIndex((e) => e.sql.includes('FROM recruit_sessions s JOIN')));
  assert.deepEqual(statements(fromResend).filter((s) => !s.startsWith('SELECT key, value')), [
    'SELECT a.id, a.email, a.role, a.decided_',
    'SELECT started_at FROM recruit_sessions ',
    'BEGIN',
    "SELECT to_jsonb(a) ->> 'do_not_rehire_re",
    'INSERT INTO recruit_applicants (role, fu',
    'UPDATE recruit_applicants SET cv_object_',
    'UPDATE recruit_applicants SET profile = ',
    'INSERT INTO recruit_audit (applicant_id,',
    'UPDATE recruit_sessions SET completed_at',
    'INSERT INTO recruit_outbox (template, to',
    'INSERT INTO recruit_llm_reviews (applica',
    'COMMIT',
  ]);

  const insert = result.log.find((e) => e.sql.startsWith('INSERT INTO recruit_applicants'));
  assert.equal(insert.params.length, 18, 'the shared insert, unchanged');
  assert.equal(insert.params[0], 'india_aidev');
  assert.equal(insert.params[6], 100, 'all-best answers score 100, on the server');
  assert.equal(insert.params[14], 'cv.pdf');
  assert.equal(insert.params[15], 'Asia/Kolkata');

  const update = result.log.find((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile'));
  assert.equal(update.sql, 'UPDATE recruit_applicants SET profile = $2 WHERE id = $1');
  assert.deepEqual(update.params, [APPLICANT, JSON.stringify(PROFILE)]);
  assert.equal(result.log.some((e) => e.sql.includes('voice_')), false, 'no voice column is touched');

  assert.deepEqual(await filesOnDisk(), ['cv.pdf']);
  await clearDisk();
});

test('the optional fields may be left out, and are stored as null', async () => {
  const result = await post(aidev, aidevForm({ githubUrl: '', employer: undefined, heardFrom: '' }));
  assert.equal(result.status, 201);
  const update = result.log.find((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile'));
  assert.deepEqual(JSON.parse(update.params[1]), { ...PROFILE, githubUrl: null, employer: null, heardFrom: null });
  await clearDisk();
});

// ── Refusals ────────────────────────────────────────────────────────────────

test('every missing piece is reported at once, keyed by field, in the form\'s order', async () => {
  const form = aidevForm(
    { city: '', qualification: '', experience: '', githubUrl: '', employer: '', heardFrom: '', noticePeriod: '', written: '{}', answers: '{}' },
    { cv: null },
  );
  const result = await post(aidev, form);
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.errors), [
    'city', 'qualification', 'experience', 'noticePeriod',
    'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7',
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12',
    'cv',
  ]);
  assert.equal(result.body.errors.cv, 'Please attach your CV.');
  assert.equal('voice' in result.body.errors, false, 'this role has no voice note to ask for');
  assert.equal(result.log.some((e) => e.sql === 'BEGIN'), false, 'nothing reached the transaction');
});

test('a missing CV alone is refused under cv', async () => {
  const result = await post(aidev, aidevForm({}, { cv: null }));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { ok: false, errors: { cv: 'Please attach your CV.' } });
  assert.equal(result.log.some((e) => e.sql === 'BEGIN'), false);
});

test('a GitHub link that is not an http(s) link, or is too long, is refused under githubUrl', async () => {
  const cases = [
    ['github.com/example', 'Enter a full link, starting with https://'],
    ['javascript:alert(1)', 'Enter a full link, starting with https://'],
    [`https://github.com/${'a'.repeat(300)}`, 'That link is too long'],
  ];
  for (const [githubUrl, message] of cases) {
    const result = await post(aidev, aidevForm({ githubUrl }));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { ok: false, errors: { githubUrl: message } });
    assert.equal(result.log.some((e) => e.sql === 'BEGIN'), false);
  }
  assert.deepEqual(await filesOnDisk(), []);
});

test('an employer over 120 characters, or a dropdown value not on the list, is refused', async () => {
  const employer = await post(aidev, aidevForm({ employer: 'x'.repeat(121) }));
  assert.deepEqual(employer.body, { ok: false, errors: { employer: 'That employer name is too long' } });

  const experience = await post(aidev, aidevForm({ experience: 'None yet' }));
  assert.deepEqual(experience.body, { ok: false, errors: { experience: 'Please choose one of the options listed' } });
});

test('the CV is checked by its content, as on every route', async () => {
  const cases = [
    [{ buffer: Buffer.from('not a pdf at all'), name: 'cv.pdf' }, 'That file does not look like a valid PDF.'],
    [{ buffer: Buffer.from('hello'), name: 'cv.txt' }, 'Please upload a PDF or Word document.'],
  ];
  for (const [cv, message] of cases) {
    const result = await post(aidev, aidevForm({}, { cv }));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { ok: false, errors: { cv: message } });
  }
  assert.deepEqual(await filesOnDisk(), []);
});

test('a 10 MB CV is accepted; one byte more is refused under cv before anything is stored', async () => {
  const exactly = Buffer.concat([PDF, Buffer.alloc(10 * MB - PDF.length)]);
  assert.equal(exactly.length, 10 * MB);
  const ok = await post(aidev, aidevForm({}, { cv: { buffer: exactly, name: 'cv.pdf' } }));
  assert.equal(ok.status, 201);
  await clearDisk();

  const refused = await post(aidev, aidevForm({}, { cv: { buffer: Buffer.concat([exactly, Buffer.alloc(1)]), name: 'cv.pdf' } }));
  assert.equal(refused.status, 400);
  assert.deepEqual(refused.body, { ok: false, errors: { cv: 'That file is larger than 10 MB.' } });
  assert.deepEqual(refused.hostErrors, [], 'a 400 the form can place, not a 500');
  assert.equal(refused.log.some((e) => e.sql === 'BEGIN'), false);
  assert.deepEqual(await filesOnDisk(), []);
});

test('a voice note, a second CV or a stray file is refused, not a 500', async () => {
  const withVoice = await post(aidev, aidevForm({}, { extra: [['voice', WEBM, 'v.webm']] }));
  assert.equal(withVoice.status, 400);
  assert.deepEqual(withVoice.body, UNREADABLE);

  const twoCvs = await post(aidev, aidevForm({}, { extra: [['cv', PDF, 'again.pdf']] }));
  assert.equal(twoCvs.status, 400);
  assert.deepEqual(twoCvs.body, UNREADABLE);

  const stray = await post(aidev, aidevForm({}, { cv: null, extra: [['photo', PDF, 'me.jpg']] }));
  assert.equal(stray.status, 400);
  assert.deepEqual(stray.body, UNREADABLE);

  for (const result of [withVoice, twoCvs, stray]) {
    assert.deepEqual(result.hostErrors, []);
    assert.equal(result.log.some((e) => e.sql === 'BEGIN'), false);
  }
});

// ── Each route accepts only its own role ────────────────────────────────────

test('/ai-developer accepts only the AI Developer role', async () => {
  for (const role of ['intern', 'paralegal', 'sales', 'india_aidev', 'nope', undefined]) {
    const result = await post(aidev, aidevForm({ role }));
    assert.equal(result.status, 400, String(role));
    assert.deepEqual(result.body, UNKNOWN_ROLE);
  }
});

test('/ refuses the AI Developer role, before anything is read or stored', async () => {
  const result = await post(base, aidevForm());
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, UNKNOWN_ROLE);
  assert.deepEqual(result.log, []);
});

test('/sales refuses the AI Developer role', async () => {
  const form = aidevForm({ voiceDuration: '45', voiceSource: 'recorded' }, { extra: [['voice', WEBM, 'blob']] });
  const result = await post(`${base}/sales`, form);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, UNKNOWN_ROLE);
  assert.equal(result.log.some((e) => e.sql === 'BEGIN'), false);
});

// ── The shared path ─────────────────────────────────────────────────────────

test('the shared path runs here too -- resend, 409, 503, do-not-rehire', async () => {
  const resent = await post(aidev, aidevForm(), { resent: 'india_aidev' });
  assert.equal(resent.status, 201);
  assert.deepEqual(resent.body, { ok: true, id: APPLICANT, acknowledged: false });
  assert.equal(resent.log.length, 1, 'a resend stores nothing');
  assert.deepEqual(await filesOnDisk(), []);

  // A resend recognised for a different role is not this application.
  const otherRole = await post(aidev, aidevForm(), { resent: 'sa_sales' });
  assert.equal(otherRole.status, 201);
  assert.ok(otherRole.log.some((e) => e.sql.startsWith('INSERT INTO recruit_applicants')));
  await clearDisk();

  const duplicate = await post(aidev, aidevForm(), { insertError: '23505' });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(duplicate.body, {
    ok: false,
    error: 'You already have an application with us for this role. We will be in touch about that one.',
  });
  assert.deepEqual(await filesOnDisk(), []);

  const failed = await post(aidev, aidevForm(), { failOn: 'INSERT INTO recruit_audit' });
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.body, { ok: false, error: 'We could not save your application just now. Please try again shortly.' });
  assert.ok(failed.log.some((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile')), 'the profile step had run');
  assert.ok(failed.log.some((e) => e.sql === 'ROLLBACK'));
  assert.deepEqual(await filesOnDisk(), [], 'the CV is removed with the rollback');

  const barred = await post(aidev, aidevForm(), { barred: true });
  assert.equal(barred.status, 201);
  assert.ok(barred.log.some((e) => e.sql.includes("'auto_declined_dnr'")));
  assert.equal(barred.log.some((e) => e.sql.startsWith('INSERT INTO recruit_outbox')), false);
  assert.equal(barred.log.some((e) => e.sql.startsWith('INSERT INTO recruit_llm_reviews')), false);
  assert.ok(barred.log.some((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile')));
  await clearDisk();
});

test('the AI detection result is stored as for any other role', async () => {
  const result = await post(aidev, aidevForm());
  const insert = result.log.find((e) => e.sql.startsWith('INSERT INTO recruit_applicants'));
  assert.ok(['clean', 'possible', 'ai_used'].includes(insert.params[7]), String(insert.params[7]));
  assert.equal(typeof insert.params[8], 'number');
  await clearDisk();
});
