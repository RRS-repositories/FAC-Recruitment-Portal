import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * POST /applications and POST /applications/sales, end to end, with no
 * database.
 *
 * The real route runs -- multer, the rate limiter, validation, scoring, AI
 * detection, the transaction, the files on disk -- against a stand-in pool
 * that records every statement. That is what lets this prove two things
 * without Postgres: the intern and paralegal path issues exactly the
 * statements it always did, and the sales path adds only its own.
 *
 * Isolation: files go to a throwaway directory, the captcha and SMTP settings
 * are cleared so nothing reaches the network, and the listener is on an
 * ephemeral loopback port for the life of this file only. Nothing is sent:
 * the route only ever queues email, and the queue here is a recorded query.
 */
const root = await mkdtemp(path.join(os.tmpdir(), 'fac-route-test-'));
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

// The host's error handler, as index.js has it: whatever the router passes on
// becomes a 500. Recorded, so a test can see what reached it.
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
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

// ── Fixtures (invented; no real person) ─────────────────────────────────────

const MB = 1024 * 1024;
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 0x20)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]), Buffer.from('webm'), Buffer.alloc(200)]);

const INTERN_ANSWERS = { q1: 0, q2: [0], s1: 0, s2: 0, s3: 0, s4: [0, 1], s5: 0, q11: 0 };
const INTERN_WRITTEN = {
  w1: 'I want this role because I have spent two years doing careful document work and I like it a lot, honestly.',
  w2: 'My experience includes drafting letters, keeping case notes, and helping clients understand what happens next.',
  w3: 'In two years I want to be qualified and running my own caseload, and this is a good step on the way there.',
};
const SALES_BEST = { q1: 0, q2: 1, q3: [0, 1, 3], q4: 0, q5: 0, q6: 1, q7: [0, 1, 3], q8: 0, q9: 0, q10: 0 };
const SALES_WRITTEN = Object.fromEntries(
  ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map((id) => [id, `An answer for ${id}, written plainly, the way I would say it on a call to a client.`]),
);
const PROFILE = {
  city: 'Testville',
  qualification: 'Diploma',
  experience: '3–5 years',
  heardFrom: 'Indeed',
  noticePeriod: '2 weeks',
};

function internForm(over = {}, cv = { buffer: PDF, name: 'cv.pdf' }) {
  const form = new FormData();
  const fields = {
    role: 'intern',
    fullName: 'Test Person',
    email: 'a@example.com',
    phone: '+00 0000 000000',
    city: 'Testville',
    written: JSON.stringify(INTERN_WRITTEN),
    answers: JSON.stringify(INTERN_ANSWERS),
    telemetry: '{}',
    sessionId: SESSION,
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value);
  if (cv) form.append('cv', new Blob([cv.buffer]), cv.name);
  return form;
}

function salesForm(over = {}, { cv = { buffer: PDF, name: 'cv.pdf' }, voice = { buffer: WEBM, name: 'blob' } } = {}) {
  const form = new FormData();
  const fields = {
    role: 'sales',
    fullName: 'Test Person',
    email: 'a@example.com',
    phone: '+00 0000 000000',
    ...PROFILE,
    written: JSON.stringify(SALES_WRITTEN),
    answers: JSON.stringify(SALES_BEST),
    telemetry: '{}',
    sessionId: SESSION,
    voiceDuration: '45',
    voiceSource: 'recorded',
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value);
  if (cv) form.append('cv', new Blob([cv.buffer]), cv.name);
  if (voice) form.append('voice', new Blob([voice.buffer]), voice.name);
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

// ── The existing route: unchanged ───────────────────────────────────────────
//
// These expectations were recorded from the route as it was on main before
// the sales role (3f18e1e), against this same stand-in pool: status, body and
// the exact sequence of statements.

const INTERN_SEQUENCE = [
  'SELECT a.id, a.email, a.role, a.decided_',
  'SELECT started_at FROM recruit_sessions ',
  'BEGIN',
  "SELECT to_jsonb(a) ->> 'do_not_rehire_re",
  'INSERT INTO recruit_applicants (role, fu',
  'UPDATE recruit_applicants SET cv_object_',
  'INSERT INTO recruit_audit (applicant_id,',
  'UPDATE recruit_sessions SET completed_at',
  'INSERT INTO recruit_outbox (template, to',
  'INSERT INTO recruit_llm_reviews (applica',
  'COMMIT',
];

test('/: a valid intern application is stored exactly as before', async () => {
  const result = await post(base, internForm());
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { ok: true, id: APPLICANT, acknowledged: false });
  // Settings reads are cached across tests, so only the statements from the
  // resend check onwards are compared.
  const fromResend = result.log.slice(result.log.findIndex((e) => e.sql.includes('FROM recruit_sessions s JOIN')));
  assert.deepEqual(statements(fromResend).filter((s) => !s.startsWith('SELECT key, value')), INTERN_SEQUENCE);

  const insert = result.log.find((e) => e.sql.startsWith('INSERT INTO recruit_applicants'));
  assert.equal(insert.params.length, 18);
  assert.equal(insert.params[0], 'india_intern');
  assert.equal(insert.params[14], 'cv.pdf');
  assert.equal(result.log.some((e) => e.sql.includes('voice_object_key')), false);
  assert.deepEqual(await filesOnDisk(), ['cv.pdf']);
  await clearDisk();
});

test('/: the paralegal role still goes through', async () => {
  const result = await post(base, internForm({ role: 'paralegal' }));
  assert.equal(result.status, 201);
  assert.equal(result.log.find((e) => e.sql.startsWith('INSERT INTO recruit_applicants')).params[0], 'sa_paralegal');
  await clearDisk();
});

test('/: the same refusals, word for word', async () => {
  const cases = [
    [internForm({}, null), 400, { ok: false, errors: { cv: 'Please attach your CV.' } }],
    [internForm({ written: '{' }), 400, { ok: false, error: 'Could not read that submission.' }],
    [internForm({ role: 'nope' }), 400, { ok: false, error: 'Unknown role.' }],
    [internForm({}, { buffer: Buffer.from('not a pdf at all'), name: 'cv.pdf' }), 400, { ok: false, errors: { cv: 'That file does not look like a valid PDF.' } }],
    [internForm({}, { buffer: Buffer.from('hello'), name: 'cv.txt' }), 400, { ok: false, errors: { cv: 'Please upload a PDF or Word document.' } }],
  ];
  for (const [form, status, body] of cases) {
    const result = await post(base, form);
    assert.equal(result.status, status);
    assert.deepEqual(result.body, body);
  }
  assert.deepEqual(await filesOnDisk(), []);
});

test('/: empty fields produce the same errors, in the same order', async () => {
  const result = await post(base, internForm({ fullName: '', email: 'x', phone: '', written: '{}', answers: '{}' }));
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.errors), [
    'fullName', 'email', 'phone', 'w1', 'w2', 'w3', 'q1', 'q2', 's1', 's2', 's3', 's4', 's5', 'q11',
  ]);
});

test('/: 409, 503, a resend and a do-not-rehire address behave as before', async () => {
  const duplicate = await post(base, internForm(), { insertError: '23505' });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(duplicate.body, {
    ok: false,
    error: 'You already have an application with us for this role. We will be in touch about that one.',
  });

  const failed = await post(base, internForm(), { insertError: 'XX000' });
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.body, { ok: false, error: 'We could not save your application just now. Please try again shortly.' });

  const resent = await post(base, internForm(), { resent: 'india_intern' });
  assert.equal(resent.status, 201);
  assert.deepEqual(resent.body, { ok: true, id: APPLICANT, acknowledged: false });
  assert.equal(resent.log.length, 1, 'a resend stores nothing');

  const barred = await post(base, internForm(), { barred: true });
  assert.equal(barred.status, 201);
  assert.ok(barred.log.some((e) => e.sql.includes("'auto_declined_dnr'")));
  assert.equal(barred.log.some((e) => e.sql.startsWith('INSERT INTO recruit_outbox')), false);
  await clearDisk();
});

test('/: an oversized or extra file still reaches the host error handler, as before', async () => {
  const big = await post(base, internForm({}, { buffer: Buffer.concat([PDF, Buffer.alloc(5 * MB)]), name: 'cv.pdf' }));
  assert.equal(big.status, 500);
  assert.equal(big.hostErrors[0]?.code, 'LIMIT_FILE_SIZE');

  const form = internForm();
  form.append('voice', new Blob([WEBM]), 'v.webm');
  const extra = await post(base, form);
  assert.equal(extra.status, 500);
  assert.equal(extra.hostErrors[0]?.code, 'LIMIT_FILE_COUNT');
});

test('/: the sales role is refused there -- it has no voice note', async () => {
  const result = await post(base, internForm({ role: 'sales' }));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { ok: false, error: 'Unknown role.' });
  assert.deepEqual(result.log, []);
});

// ── The sales route ─────────────────────────────────────────────────────────

test('/sales: a valid application stores the CV, the voice note and the profile', async () => {
  const result = await post(`${base}/sales`, salesForm());
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { ok: true, id: APPLICANT, acknowledged: false });

  const insert = result.log.find((e) => e.sql.startsWith('INSERT INTO recruit_applicants'));
  assert.equal(insert.params[0], 'sa_sales');
  assert.equal(insert.params[6], 100, 'all-best answers score 100, on the server');
  assert.equal(insert.params[15], 'Africa/Johannesburg');

  const update = result.log.find((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile'));
  assert.deepEqual(update.params, [
    APPLICANT,
    JSON.stringify({ ...PROFILE }),
    `${APPLICANT}/voice.webm`,
    'voice-note.webm',
    'audio/webm',
    WEBM.length,
    45,
    'recorded',
  ]);

  // Everything the other roles get, in the same transaction.
  const sequence = statements(result.log);
  for (const expected of INTERN_SEQUENCE) assert.ok(sequence.includes(expected), expected);
  const profileAt = sequence.indexOf('UPDATE recruit_applicants SET profile = ');
  assert.ok(profileAt > sequence.indexOf('UPDATE recruit_applicants SET cv_object_'));
  assert.ok(profileAt < sequence.indexOf('COMMIT'));

  assert.deepEqual(await filesOnDisk(), ['cv.pdf', 'voice.webm']);
  assert.deepEqual(await readFile(path.join(root, APPLICANT, 'voice.webm')), WEBM);
  await clearDisk();
});

test('/sales: a 10 MB CV is accepted; one byte more is refused under cv, and nothing is left behind', async () => {
  const ok = await post(`${base}/sales`, salesForm({}, { cv: { buffer: Buffer.concat([PDF, Buffer.alloc(9 * MB)]), name: 'cv.pdf' } }));
  assert.equal(ok.status, 201);
  await clearDisk();

  const big = Buffer.concat([PDF, Buffer.alloc(10 * MB - PDF.length + 1)]);
  const refused = await post(`${base}/sales`, salesForm({}, { cv: { buffer: big, name: 'cv.pdf' } }));
  assert.equal(refused.status, 400);
  assert.deepEqual(refused.body, { ok: false, errors: { cv: 'That file is larger than 10 MB.' } });
  // Refused as soon as the upload is read: no transaction is ever opened.
  assert.equal(refused.log.some((e) => e.sql === 'BEGIN'), false);
  assert.deepEqual(await filesOnDisk(), []);
});

test('/sales: every missing piece is reported at once, keyed by field', async () => {
  const form = salesForm(
    { city: '', qualification: '', experience: '', heardFrom: '', noticePeriod: '', written: '{}', answers: '{}' },
    { cv: null, voice: null },
  );
  const result = await post(`${base}/sales`, form);
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.errors), [
    'city', 'qualification', 'experience', 'noticePeriod',
    'w1', 'w2', 'w3', 'w4', 'w5', 'w6',
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
    'cv', 'voice',
  ]);
  assert.equal(result.body.errors.voice, 'Please add your voice note.');
  assert.equal(result.body.errors.cv, 'Please attach your CV.');
  assert.equal(result.log.some((e) => e.sql === 'BEGIN'), false, 'nothing reached the transaction');
});

test('/sales: a dropdown value that is not on the list is refused', async () => {
  const result = await post(`${base}/sales`, salesForm({ experience: '20 years' }));
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.errors), ['experience']);
});

test('/sales: the voice note must be audio, of a believable length, from a known source', async () => {
  const cases = [
    [salesForm({}, { voice: { buffer: PDF, name: 'note.webm' } }), 'That file does not look like an audio recording.'],
    [salesForm({ voiceDuration: '5' }), 'Your voice note is under 10 seconds.'],
    [salesForm({ voiceDuration: '423' }), 'Your voice note is longer than 7 minutes.'],
    [salesForm({ voiceDuration: '4.5' }), 'We could not tell how long your voice note is.'],
    [salesForm({ voiceDuration: undefined }), 'We could not tell how long your voice note is.'],
    [salesForm({ voiceSource: 'microphone' }), 'We could not tell how your voice note was added.'],
  ];
  for (const [form, startsWith] of cases) {
    const result = await post(`${base}/sales`, form);
    assert.equal(result.status, 400);
    assert.deepEqual(Object.keys(result.body.errors), ['voice']);
    assert.ok(result.body.errors.voice.startsWith(startsWith), result.body.errors.voice);
  }
  assert.deepEqual(await filesOnDisk(), []);
});

test('/sales: an uploaded m4a is accepted and stored as what it is', async () => {
  const m4a = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(100)]);
  const result = await post(
    `${base}/sales`,
    salesForm({ voiceSource: 'uploaded', voiceDuration: '422', heardFrom: '' }, { voice: { buffer: m4a, name: 'Interview note.m4a' } }),
  );
  assert.equal(result.status, 201);
  const update = result.log.find((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile'));
  assert.equal(JSON.parse(update.params[1]).heardFrom, null);
  assert.deepEqual(update.params.slice(2), [`${APPLICANT}/voice.m4a`, 'Interview note.m4a', 'audio/mp4', m4a.length, 422, 'uploaded']);
  await clearDisk();
});

test('/sales: multer refusals come back as 400s the form can place, not 500s', async () => {
  const bigVoice = await post(
    `${base}/sales`,
    salesForm({}, { voice: { buffer: Buffer.concat([WEBM, Buffer.alloc(25 * MB)]), name: 'v.webm' } }),
  );
  assert.equal(bigVoice.status, 400);
  assert.deepEqual(Object.keys(bigVoice.body.errors), ['voice']);
  assert.match(bigVoice.body.errors.voice, /larger than 25 MB/);

  const bigCv = await post(
    `${base}/sales`,
    salesForm({}, { cv: { buffer: Buffer.concat([PDF, Buffer.alloc(25 * MB)]), name: 'cv.pdf' } }),
  );
  assert.equal(bigCv.status, 400);
  assert.deepEqual(bigCv.body, { ok: false, errors: { cv: 'That file is larger than 10 MB.' } });

  const twoNotes = salesForm({}, { cv: null });
  twoNotes.append('voice', new Blob([WEBM]), 'again.webm');
  const twice = await post(`${base}/sales`, twoNotes);
  assert.equal(twice.status, 400);
  assert.deepEqual(twice.body, { ok: false, errors: { voice: 'Please add just one voice note.' } });

  // A third file of any kind is over the two-file limit before multer looks
  // at its name, so there is no one field to blame.
  const three = salesForm();
  three.append('voice', new Blob([WEBM]), 'again.webm');
  const tooMany = await post(`${base}/sales`, three);
  assert.equal(tooMany.status, 400);
  assert.deepEqual(tooMany.body, { ok: false, error: 'Could not read that submission.' });

  const stray = salesForm();
  stray.append('photo', new Blob([PDF]), 'me.jpg');
  const unexpected = await post(`${base}/sales`, stray);
  assert.equal(unexpected.status, 400);
  assert.deepEqual(unexpected.body, { ok: false, error: 'Could not read that submission.' });

  for (const result of [bigVoice, bigCv, twice, tooMany, unexpected]) assert.deepEqual(result.hostErrors, []);
});

test('/sales: only the sales role is accepted there', async () => {
  for (const role of ['intern', 'paralegal', 'nope', undefined]) {
    const result = await post(`${base}/sales`, salesForm({ role }));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { ok: false, error: 'Unknown role.' });
  }
});

test('/sales: a failure after both files are written rolls back and removes both', async () => {
  const result = await post(`${base}/sales`, salesForm(), { failOn: 'INSERT INTO recruit_audit' });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { ok: false, error: 'We could not save your application just now. Please try again shortly.' });
  assert.ok(result.log.some((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile')), 'the voice step had run');
  assert.ok(result.log.some((e) => e.sql === 'ROLLBACK'));
  assert.deepEqual(await filesOnDisk(), []);
});

test('/sales: the shared path runs for sales too -- resend, 409, do-not-rehire', async () => {
  const resent = await post(`${base}/sales`, salesForm(), { resent: 'sa_sales' });
  assert.equal(resent.status, 201);
  assert.deepEqual(resent.body, { ok: true, id: APPLICANT, acknowledged: false });
  assert.equal(resent.log.length, 1);

  // A resend recognised for a different role is not this application.
  const otherRole = await post(`${base}/sales`, salesForm(), { resent: 'india_intern' });
  assert.equal(otherRole.status, 201);
  assert.ok(otherRole.log.some((e) => e.sql.startsWith('INSERT INTO recruit_applicants')));
  await clearDisk();

  const duplicate = await post(`${base}/sales`, salesForm(), { insertError: '23505' });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await filesOnDisk(), []);

  const barred = await post(`${base}/sales`, salesForm(), { barred: true });
  assert.equal(barred.status, 201);
  assert.ok(barred.log.some((e) => e.sql.includes("'auto_declined_dnr'")));
  assert.equal(barred.log.some((e) => e.sql.startsWith('INSERT INTO recruit_outbox')), false);
  assert.ok(barred.log.some((e) => e.sql.startsWith('UPDATE recruit_applicants SET profile')));
  await clearDisk();
});
