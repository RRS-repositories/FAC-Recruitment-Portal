import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

/**
 * normalise.js imports `@/data/roles`, which imports role photos -- both are
 * Vite-isms plain Node cannot load. A small module hook, registered before the
 * import, maps `@/` onto src/ and stands in for any image with a string. It is
 * inline so the test needs no loader file and no change to the test script.
 */
const HOOKS = `
let src;
export async function initialize(data) { src = data.src; }
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    let path = specifier.slice(2);
    if (!/\\.[a-z0-9]+$/i.test(path)) path += '.js';
    return next(new URL(path, src).href, context);
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (/\\.(jpe?g|png|webp|gif|svg|avif)$/i.test(url)) {
    return { format: 'module', source: 'export default "image-stub";', shortCircuit: true };
  }
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`, {
  data: { src: new URL('../', import.meta.url).href },
});

const { normaliseApplicant } = await import('./normalise.js');

/** A detail row for the intern role, shaped as the API returns it today. */
const INTERN_ROW = {
  id: 41,
  role: 'india_intern',
  full_name: 'Test Applicant',
  email: 'applicant@example.test',
  phone: '+10000000000',
  created_at: '2026-09-01T10:00:00.000Z',
  final_score: 72,
  rule_score: 70,
  status: 'pending',
  meet_link: null,
  interview_status: null,
  interview_at: null,
  duration_sec: 812,
  ai_use_level: 'clean',
  ai_use_score: 4,
  ai_use_reasons: ['one', 2, 'three'],
  cv_filename: 'cv.pdf',
  cv_deleted_at: null,
  decided_by_email: null,
  do_not_rehire: false,
  decided_at: null,
  written_answers: { w1: 'a', w2: 'b', w3: 'c' },
  mcq_answers: { s1: 0, s2: [1, 2] },
};

/**
 * What that row normalised to before the sales role existed -- written out by
 * hand, key for key, so any new key on an existing row fails this test.
 */
const INTERN_EXPECTED = {
  id: 41,
  role: 'intern',
  fullName: 'Test Applicant',
  email: 'applicant@example.test',
  phone: '+10000000000',
  createdAt: '2026-09-01T10:00:00.000Z',
  score: 72,
  status: 'pending',
  meetLink: null,
  interviewStatus: 'not_invited',
  interviewAt: null,
  interviewFinalChance: false,
  interviewExpiresAt: null,
  noShowCount: 0,
  durationSec: 812,
  ai: { level: 'clean', score: 4, reasons: ['one', 'three'] },
  cvFilename: 'cv.pdf',
  cvDeletedAt: null,
  decidedByEmail: null,
  doNotRehire: false,
  doNotRehireReason: null,
  decidedAt: null,
  written: { w1: 'a', w2: 'b', w3: 'c' },
  answers: { s1: 0, s2: [1, 2] },
};

test('an existing-role row normalises exactly as before', () => {
  assert.deepStrictEqual(normaliseApplicant(INTERN_ROW), INTERN_EXPECTED);
});

test('an existing-role row with the new columns present but null is unchanged too', () => {
  // After the migration a `SELECT *` returns the sales columns on every row,
  // null for intern and paralegal applicants.
  const row = {
    ...INTERN_ROW,
    role: 'sa_paralegal',
    profile: null,
    voice_object_key: null,
    voice_filename: null,
    voice_mime: null,
    voice_size_bytes: null,
    voice_duration_sec: null,
    voice_source: null,
    voice_deleted_at: null,
  };
  const result = normaliseApplicant(row);
  assert.deepStrictEqual(result, { ...INTERN_EXPECTED, role: 'paralegal' });
  assert.equal('profile' in result, false);
  assert.equal('voice' in result, false);
});

test('a list row (no detail fields) still gets null written/answers and nothing new', () => {
  const { written_answers, mcq_answers, ...listRow } = INTERN_ROW;
  const result = normaliseApplicant(listRow);
  assert.equal(result.written, null);
  assert.equal(result.answers, null);
  assert.equal('profile' in result, false);
  assert.equal('voice' in result, false);
});

const SALES_ROW = {
  ...INTERN_ROW,
  role: 'sa_sales',
  profile: {
    city: 'Durban',
    qualification: 'Matric',
    experience: '1-2 years',
    heardFrom: 'LinkedIn',
    noticePeriod: '1 month',
  },
  voice_object_key: 'voice/abc',
  voice_filename: 'note.webm',
  voice_mime: 'audio/webm;codecs=opus',
  voice_size_bytes: '48213', // bigint columns arrive as strings from pg
  voice_duration_sec: 64,
  voice_source: 'recorded',
  voice_deleted_at: null,
};

test('a sales row gets profile and voice', () => {
  const result = normaliseApplicant(SALES_ROW);
  assert.deepStrictEqual(result.profile, SALES_ROW.profile);
  assert.deepStrictEqual(result.voice, {
    filename: 'note.webm',
    mime: 'audio/webm;codecs=opus',
    sizeBytes: 48213,
    durationSec: 64,
    source: 'recorded',
    deletedAt: null,
    present: true,
  });
  // Everything that is not sales-specific is as for any other row.
  const { profile, voice, ...rest } = result;
  assert.deepStrictEqual(rest, { ...INTERN_EXPECTED, role: rest.role });
});

test('a deleted voice note keeps its metadata but is not playable', () => {
  const result = normaliseApplicant({
    ...SALES_ROW,
    voice_object_key: null,
    voice_source: 'uploaded',
    voice_deleted_at: '2027-03-01T00:00:00.000Z',
  });
  assert.equal(result.voice.present, false);
  assert.equal(result.voice.deletedAt, '2027-03-01T00:00:00.000Z');
  assert.equal(result.voice.source, 'uploaded');
  assert.equal(result.voice.filename, 'note.webm');
});

test('a sales row with no voice note and no profile adds nothing', () => {
  const result = normaliseApplicant({
    ...INTERN_ROW,
    role: 'sa_sales',
    profile: null,
    voice_object_key: null,
    voice_filename: null,
    voice_deleted_at: null,
  });
  assert.equal('profile' in result, false);
  assert.equal('voice' in result, false);
});

/** An AI developer detail row as `SELECT a.*` returns it: voice columns null. */
const AIDEV_ROW = {
  ...INTERN_ROW,
  role: 'india_aidev',
  profile: {
    city: 'Pune',
    qualification: 'B.Tech',
    experience: '3-5 years',
    githubUrl: '',
    employer: '',
    heardFrom: 'LinkedIn',
    noticePeriod: '30 days',
  },
  telemetry: { pasteChars: 0, typedChars: 900, activeSecs: 300, tabSwitches: 1, writtenSecs: 600, stepTimes: {} },
  voice_object_key: null,
  voice_filename: null,
  voice_mime: null,
  voice_size_bytes: null,
  voice_duration_sec: null,
  voice_source: null,
  voice_deleted_at: null,
};

test('an AI developer row gets its profile, empty strings kept, and no voice', () => {
  const result = normaliseApplicant(AIDEV_ROW);
  assert.deepStrictEqual(result.profile, AIDEV_ROW.profile);
  assert.equal('voice' in result, false);
  // Everything else is as for any other row -- telemetry is not mapped.
  const { profile, ...rest } = result;
  assert.deepStrictEqual(rest, { ...INTERN_EXPECTED, role: rest.role });
});

test('an AI developer row maps to the ai-developer slug once ROLES has it', async () => {
  const { ROLES } = await import('../data/roles.js');
  const result = normaliseApplicant(AIDEV_ROW);
  // Until data/roles.js gains the entry the raw enum passes through, which the
  // dashboard's panel choice accepts too; afterwards it is the slug.
  assert.equal(result.role, ROLES['ai-developer'] ? 'ai-developer' : 'india_aidev');
});

test('an AI developer list row (no profile yet) adds nothing', () => {
  const { profile, telemetry, written_answers, mcq_answers, ...listRow } = AIDEV_ROW;
  const result = normaliseApplicant(listRow);
  assert.equal('profile' in result, false);
  assert.equal('voice' in result, false);
});

test('a profile that is not a plain object is ignored', () => {
  assert.equal('profile' in normaliseApplicant({ ...INTERN_ROW, profile: ['x'] }), false);
  assert.equal('profile' in normaliseApplicant({ ...INTERN_ROW, profile: 'x' }), false);
});
