import test from 'node:test';
import assert from 'node:assert/strict';

import { SALES } from './config.js';
import { SALES_APPLY_PATH, SALES_APPLY_REDIRECTS, SALES_PATH, SALES_REDIRECTS } from './paths.js';
import { detailProblems, emptyDetails, stepForServerErrors } from '../role-page/helpers.js';
import { buildRoleFormData } from '../role-page/formData.js';

test('the sales URL is written once, and the redirects never loop onto it', () => {
  assert.equal(SALES_PATH, '/recruitment/sales');
  assert.equal(SALES_APPLY_PATH, '/recruitment/sales/apply');
  assert.equal(SALES.path, SALES_PATH);
  assert.equal(SALES.applyPath, SALES_APPLY_PATH);
  // The generic apply address must reach the sales FORM, never the paralegal one.
  assert.ok(SALES_APPLY_REDIRECTS.includes('/recruitment/apply/sales'));
  // Nothing redirects to itself.
  assert.ok(!SALES_REDIRECTS.includes(SALES_PATH));
  assert.ok(!SALES_APPLY_REDIRECTS.includes(SALES_APPLY_PATH));
});

test('five steps in the design order, voice note fourth', () => {
  assert.deepEqual(
    SALES.steps.map((s) => s.page),
    ['details', 'written', 'assessment', 'voice', 'cv'],
  );
  assert.deepEqual(
    SALES.steps.map((s) => s.label),
    ['Your details', 'About you', 'Assessment', 'Voice note', 'CV & submit'],
  );
  assert.deepEqual(Object.keys(SALES.extraStepErrors), ['voice']);
});

test('details: every field but "where did you hear" is required, email must look like one', () => {
  const full = {
    fullName: 'A Person',
    email: 'a@example.com',
    phone: '+27 82 000 0000',
    city: 'Cape Town',
    qualification: 'Diploma',
    experience: '1–2 years',
    heardFrom: '',
    noticePeriod: '1 week',
  };
  assert.deepEqual(Object.keys(emptyDetails(SALES.detailFields)), Object.keys(full));
  assert.deepEqual(detailProblems(full, SALES.detailFields), {});
  assert.deepEqual(detailProblems({ ...full, email: 'not-an-email' }, SALES.detailFields), { email: true });
  assert.deepEqual(detailProblems({ ...full, city: '   ', noticePeriod: '' }, SALES.detailFields), {
    city: true,
    noticePeriod: true,
  });
  // Every select draws from a fallback list that exists.
  for (const f of SALES.detailFields.filter((x) => x.kind === 'select')) {
    assert.ok(SALES.fallbackDetailOptions[f.list]?.length, f.name);
  }
});

test('a sales refusal is sent back to the step that owns it, voice included', () => {
  const opts = { detailNames: SALES.detailFields.map((f) => f.name), extraSteps: SALES.extraStepErrors };
  assert.equal(stepForServerErrors({ email: 'Bad email' }, opts).page, 'details');
  assert.deepEqual(stepForServerErrors({ voice: 'Too long' }, opts), { page: 'voice', message: 'Too long' });
  assert.equal(stepForServerErrors({ voiceDuration: 'x' }, opts).page, 'voice');
  assert.equal(stepForServerErrors({ voiceSource: 'x' }, opts).page, 'voice');
});

test('the design copy for the shared steps', () => {
  assert.equal(
    SALES.copy.assessmentSub(10),
    "Ten real situations from the job. Pick the answer that's closest to what you'd actually do — there's no time limit.",
  );
  assert.equal(SALES.copy.cvSub(10 * 1024 * 1024), 'Last step. PDF or Word, up to 10 MB.');
  assert.equal(SALES.copy.detailsError, 'Please complete every field (and check your email address).');
});

test('the sales multipart body carries exactly the agreed fields, in order', async () => {
  const cv = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
  const voiceFile = new File(['audio'], 'voice-note.webm', { type: 'audio/webm' });
  const form = buildRoleFormData(SALES, {
    details: {
      fullName: 'A Person',
      email: 'a@example.com',
      phone: '1',
      city: 'Durban',
      qualification: 'Diploma',
      experience: 'None yet',
      heardFrom: '',
      noticePeriod: '1 week',
    },
    written: { w1: 'hello' },
    answers: { q1: 0, q3: [1, 2] },
    telemetry: { pasteChars: 0 },
    sessionId: 'sess-1',
    source: 'Direct',
    captchaToken: null,
    cv,
    extras: { voice: { file: voiceFile, duration: 64.6, source: 'recorded' } },
  });

  assert.deepEqual(
    [...form.keys()],
    [
      'role', 'fullName', 'email', 'phone', 'city', 'qualification', 'experience', 'heardFrom',
      'noticePeriod', 'written', 'answers', 'telemetry', 'sessionId', 'source', 'cv',
      'voice', 'voiceDuration', 'voiceSource',
    ],
  );
  assert.equal(form.get('role'), 'sales');
  assert.deepEqual(JSON.parse(form.get('written')), { w1: 'hello' });
  assert.deepEqual(JSON.parse(form.get('answers')), { q1: 0, q3: [1, 2] });
  assert.equal(form.get('voiceDuration'), '65');
  assert.equal(form.get('voiceSource'), 'recorded');
  assert.equal(form.get('voice').name, 'voice-note.webm');
  assert.equal(form.get('cv').name, 'cv.pdf');
  assert.equal(form.has('captchaToken'), false);
});
