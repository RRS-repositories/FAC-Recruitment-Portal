import test from 'node:test';
import assert from 'node:assert/strict';

import { AIDEV } from './config.js';
import { AIDEV_APPLY_PATH, AIDEV_APPLY_REDIRECTS, AIDEV_PATH, AIDEV_REDIRECTS } from './paths.js';
import { SALES } from '../sales/config.js';
import { detailProblems, detailsMessage, emptyDetails, stepForServerErrors } from '../role-page/helpers.js';
import { buildRoleFormData } from '../role-page/formData.js';

test('the AI developer URL is written once, and the redirects never loop onto it', () => {
  assert.equal(AIDEV_PATH, '/recruitment/ai-developer');
  assert.equal(AIDEV_APPLY_PATH, '/recruitment/ai-developer/apply');
  assert.equal(AIDEV.path, AIDEV_PATH);
  assert.equal(AIDEV.applyPath, AIDEV_APPLY_PATH);
  // The generic apply address must reach this FORM, never the paralegal one.
  assert.ok(AIDEV_APPLY_REDIRECTS.includes('/recruitment/apply/ai-developer'));
  assert.ok(!AIDEV_REDIRECTS.includes(AIDEV_PATH));
  assert.ok(!AIDEV_APPLY_REDIRECTS.includes(AIDEV_APPLY_PATH));
});

test('four steps in the design order, and no voice note', () => {
  assert.deepEqual(AIDEV.steps.map((s) => s.page), ['details', 'written', 'assessment', 'cv']);
  assert.deepEqual(AIDEV.steps.map((s) => s.label), [
    'Your details',
    'Your experience',
    'Technical assessment',
    'CV & submit',
  ]);
  assert.deepEqual(AIDEV.extraStepErrors, {});
  assert.equal(AIDEV.appendExtras, undefined);
  assert.equal(AIDEV.defaultLimits.cvMaxBytes, 10 * 1024 * 1024);
});

test('two roles, two slugs, two id prefixes', () => {
  assert.notEqual(AIDEV.slug, SALES.slug);
  assert.notEqual(AIDEV.idPrefix, SALES.idPrefix);
  assert.equal(AIDEV.slug, 'ai-developer');
});

const full = {
  fullName: 'Arjun Test',
  email: 'arjun@example.com',
  phone: '+91 98000 00000',
  city: 'Pune',
  qualification: 'B.Tech / B.E.',
  experience: '3–5 years',
  githubUrl: '',
  employer: '',
  heardFrom: '',
  noticePeriod: '1 month',
};

test('details: the design order; link, employer and "where did you hear" are optional', () => {
  assert.deepEqual(Object.keys(emptyDetails(AIDEV.detailFields)), Object.keys(full));
  assert.deepEqual(detailProblems(full, AIDEV.detailFields), {});
  assert.deepEqual(detailProblems({ ...full, email: 'nope' }, AIDEV.detailFields), { email: true });
  assert.deepEqual(detailProblems({ ...full, city: '', noticePeriod: '' }, AIDEV.detailFields), {
    city: true,
    noticePeriod: true,
  });
  for (const f of AIDEV.detailFields.filter((x) => x.kind === 'select')) {
    assert.ok(AIDEV.fallbackDetailOptions[f.list]?.length, f.name);
  }
});

test('a portfolio link, if given, must be a web address — with its own message', () => {
  const bad = detailProblems({ ...full, githubUrl: 'github.com/arjun' }, AIDEV.detailFields);
  assert.deepEqual(bad, { githubUrl: true });
  assert.match(detailsMessage(bad, AIDEV.detailFields, AIDEV.copy.detailsError), /GitHub \/ portfolio URL/);
  assert.deepEqual(detailProblems({ ...full, githubUrl: 'https://github.com/arjun' }, AIDEV.detailFields), {});
  // Anything else wrong as well: the design's own line.
  const both = detailProblems({ ...full, githubUrl: 'x', phone: '' }, AIDEV.detailFields);
  assert.equal(
    detailsMessage(both, AIDEV.detailFields, AIDEV.copy.detailsError),
    'Please complete every required field (and check your email address).',
  );
});

test('a refusal of the new fields goes back to the details step', () => {
  const opts = { detailNames: AIDEV.detailFields.map((f) => f.name), extraSteps: AIDEV.extraStepErrors };
  assert.equal(stepForServerErrors({ githubUrl: 'x' }, opts).page, 'details');
  assert.equal(stepForServerErrors({ employer: 'x' }, opts).page, 'details');
  assert.deepEqual(stepForServerErrors({ w7: 'Too short' }, opts), { page: 'written', message: 'Too short' });
});

test('the design copy for the shared steps', () => {
  assert.equal(
    AIDEV.copy.assessmentSub(12),
    "Twelve situations from the actual job. Pick what you'd really do — no time limit, no trick questions.",
  );
  assert.equal(
    AIDEV.copy.cvSub(10 * 1024 * 1024),
    'Last step. PDF or Word, up to 10 MB. A link to your GitHub in the CV helps.',
  );
  assert.equal(AIDEV.brandLine, 'AI Developer · India (remote)');
});

test('the multipart body carries exactly the agreed fields, in order', () => {
  const cv = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
  const form = buildRoleFormData(AIDEV, {
    details: { ...full, githubUrl: 'https://github.com/arjun', employer: 'Acme' },
    written: { w1: 'hello', w7: 'yes' },
    answers: { q1: 0, q3: [0, 1] },
    telemetry: { pasteChars: 12, typedChars: 300 },
    sessionId: 'sess-1',
    source: 'Direct',
    captchaToken: 'tok',
    cv,
    extras: {},
  });
  assert.deepEqual(
    [...form.keys()],
    [
      'role', 'fullName', 'email', 'phone', 'city', 'qualification', 'experience', 'githubUrl',
      'employer', 'heardFrom', 'noticePeriod', 'written', 'answers', 'telemetry', 'sessionId',
      'source', 'captchaToken', 'cv',
    ],
  );
  assert.equal(form.get('role'), 'ai-developer');
  assert.equal(form.get('githubUrl'), 'https://github.com/arjun');
  assert.equal(form.get('employer'), 'Acme');
  assert.equal(form.get('heardFrom'), '');
  assert.deepEqual(JSON.parse(form.get('written')), { w1: 'hello', w7: 'yes' });
  assert.deepEqual(JSON.parse(form.get('telemetry')), { pasteChars: 12, typedChars: 300 });
  assert.equal(form.get('cv').name, 'cv.pdf');
  assert.equal(form.has('voice'), false);
});
