import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkCvFile,
  countWord,
  detailProblems,
  detailsMessage,
  emptyDetails,
  formatMB,
  looksLikeUrl,
  missingAnswersMessage,
  pickDetailOptions,
  shortWrittenMessage,
  stepForServerErrors,
  wholeMB,
  wordCount,
} from './helpers.js';
import { buildRoleFormData } from './formData.js';

const MB = 1024 * 1024;

test('word count matches the designs: whitespace-separated runs', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount(undefined), 0);
  assert.equal(wordCount('one'), 1);
  assert.equal(wordCount('  two   words \n'), 2);
  assert.equal(wordCount("I've sold\tphones, honestly."), 4);
});

test('sizes and counts read as the designs word them', () => {
  assert.equal(formatMB(1.44 * MB), '1.4');
  assert.equal(wholeMB(10 * MB), 10);
  assert.equal(countWord(10), 'Ten');
  assert.equal(countWord(12), 'Twelve');
  assert.equal(countWord(14), '14');
});

test('CV: PDF or Word, under the cap', () => {
  assert.equal(checkCvFile({ name: 'Me.PDF', size: MB }, { maxBytes: 10 * MB }), '');
  assert.equal(checkCvFile({ name: 'me.docx', size: MB }, { maxBytes: 10 * MB }), '');
  assert.match(checkCvFile({ name: 'me.png', size: MB }, { maxBytes: 10 * MB }), /isn't supported/);
  assert.equal(checkCvFile({ name: 'me.pdf', size: 11 * MB }, { maxBytes: 10 * MB }), 'CV is over 10 MB.');
  assert.equal(checkCvFile(null, { maxBytes: MB }), 'Please choose your CV.');
});

test('written answers: lists every question still short of its minimum', () => {
  const questions = [
    { id: 'w1', minWords: 3 },
    { id: 'w2', minWords: 2 },
    { id: 'w3', minWords: 1 },
  ];
  assert.equal(shortWrittenMessage(questions, { w1: 'a b c', w2: 'a b', w3: 'a' }), '');
  assert.equal(
    shortWrittenMessage(questions, { w1: 'a b', w2: 'a b', w3: 'a' }),
    'Question 1 needs a few more words.',
  );
  assert.equal(shortWrittenMessage(questions, { w2: 'a' }), 'Questions 1, 2, 3 need a few more words.');
});

test('assessment: an index for single, a non-empty array for multi', () => {
  const questions = [{ id: 'q1' }, { id: 'q2', multi: true }, { id: 'q3' }];
  assert.equal(missingAnswersMessage(questions, { q1: 0, q2: [1], q3: 3 }), '');
  assert.equal(missingAnswersMessage(questions, { q1: 0, q2: [], q3: 2 }), 'Please answer question 2.');
  assert.equal(missingAnswersMessage(questions, {}), 'Please answer questions 1, 2, 3.');
});

test('a portfolio link must be an http(s) address with a real host', () => {
  assert.equal(looksLikeUrl('https://github.com/someone'), true);
  assert.equal(looksLikeUrl('http://my-site.dev'), true);
  assert.equal(looksLikeUrl('  https://gitlab.com/a/b  '), true);
  assert.equal(looksLikeUrl('github.com/someone'), false);
  assert.equal(looksLikeUrl('ftp://github.com/x'), false);
  assert.equal(looksLikeUrl('https://localhost'), false);
  assert.equal(looksLikeUrl('https://git hub.com'), false);
  assert.equal(looksLikeUrl('javascript:alert(1)'), false);
  assert.equal(looksLikeUrl(''), false);
});

const FIELDS = [
  { name: 'fullName', required: true },
  { name: 'email', required: true, check: 'email' },
  { name: 'site', check: 'url', message: 'Check the link.' },
  { name: 'heardFrom' },
];

test('details: required blanks and bad values are problems; optional blanks are not', () => {
  assert.deepEqual(emptyDetails(FIELDS), { fullName: '', email: '', site: '', heardFrom: '' });
  const ok = { fullName: 'A Person', email: 'a@example.com', site: '', heardFrom: '' };
  assert.deepEqual(detailProblems(ok, FIELDS), {});
  assert.deepEqual(detailProblems({ ...ok, fullName: '  ' }, FIELDS), { fullName: true });
  assert.deepEqual(detailProblems({ ...ok, email: 'nope' }, FIELDS), { email: true });
  assert.deepEqual(detailProblems({ ...ok, site: 'github.com/me' }, FIELDS), { site: true });
  assert.deepEqual(detailProblems({ ...ok, site: 'https://github.com/me' }, FIELDS), {});
});

test("details message: the design's line, or the field's own when only a link is wrong", () => {
  const design = 'Please complete every required field (and check your email address).';
  assert.equal(detailsMessage({}, FIELDS, design), '');
  assert.equal(detailsMessage({ email: true }, FIELDS, design), design);
  assert.equal(detailsMessage({ site: true }, FIELDS, design), 'Check the link.');
  assert.equal(detailsMessage({ site: true, fullName: true }, FIELDS, design), design);
});

test('dropdowns: the server list when it has one, else the fallback', () => {
  const fallback = { a: ['x'], b: ['y'] };
  assert.deepEqual(pickDetailOptions(undefined, fallback), fallback);
  assert.deepEqual(pickDetailOptions({ a: ['p', '', 'q'], b: [] }, fallback), { a: ['p', 'q'], b: ['y'] });
  assert.deepEqual(pickDetailOptions({ a: 'not a list' }, fallback), fallback);
});

test('a server refusal is sent back to the step that owns it', () => {
  const opts = { detailNames: ['fullName', 'email', 'githubUrl'], extraSteps: { voice: ['voice', 'voiceDuration'] } };
  assert.equal(stepForServerErrors({ email: 'Bad email' }, opts).page, 'details');
  assert.equal(stepForServerErrors({ githubUrl: 'Bad link' }, opts).page, 'details');
  assert.deepEqual(stepForServerErrors({ w3: 'Too short' }, opts), { page: 'written', message: 'Too short' });
  assert.equal(stepForServerErrors({ answers: 'Missing' }, opts).page, 'assessment');
  assert.deepEqual(stepForServerErrors({ voiceDuration: 'Too long' }, opts), { page: 'voice', message: 'Too long' });
  assert.deepEqual(stepForServerErrors({ cv: 'Not a CV' }, opts), { page: 'cv', message: 'Not a CV' });
  assert.equal(stepForServerErrors({ captchaToken: 'x' }, opts).page, 'cv');
  assert.equal(stepForServerErrors({ somethingElse: 'x' }, opts).page, 'cv');
  // A role without a voice step never sends anyone to one.
  assert.equal(stepForServerErrors({ voice: 'x' }, { detailNames: [] }).page, 'cv');
});

test('the multipart body: role, detail fields in order, JSON parts, session, CV, extras', async () => {
  const cv = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
  const config = {
    slug: 'some-role',
    detailFields: [{ name: 'fullName' }, { name: 'email' }, { name: 'extra' }],
    appendExtras: (form, extras) => {
      if (extras.note) form.set('note', extras.note);
    },
  };
  const form = buildRoleFormData(config, {
    details: { fullName: 'A Person', email: 'a@example.com' },
    written: { w1: 'hello' },
    answers: { q1: 0 },
    telemetry: { pasteChars: 3 },
    sessionId: 'sess-1',
    source: 'Direct',
    captchaToken: null,
    cv,
    extras: { note: 'hi' },
  });
  assert.deepEqual(
    [...form.keys()],
    ['role', 'fullName', 'email', 'extra', 'written', 'answers', 'telemetry', 'sessionId', 'source', 'cv', 'note'],
  );
  assert.equal(form.get('role'), 'some-role');
  assert.equal(form.get('extra'), '');
  assert.deepEqual(JSON.parse(form.get('telemetry')), { pasteChars: 3 });
  assert.equal(form.get('cv').name, 'cv.pdf');
  assert.equal(form.has('captchaToken'), false);
});
