import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkAudioDuration,
  checkAudioFile,
  checkCvFile,
  countWord,
  detailProblems,
  formatClock,
  formatMB,
  minutesLabel,
  missingAnswersMessage,
  recordingTooShort,
  shortWrittenMessage,
  stepForServerErrors,
  voiceFileName,
  wordCount,
} from './helpers.js';
import { buildSalesFormData } from './formData.js';
import { SALES_PATH, SALES_REDIRECTS } from './paths.js';

const MB = 1024 * 1024;
const LIMITS = { minSeconds: 10, maxSeconds: 420 };

test('word count matches the design: whitespace-separated runs', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount(undefined), 0);
  assert.equal(wordCount('one'), 1);
  assert.equal(wordCount('  two   words \n'), 2);
  assert.equal(wordCount("I've sold\tphones, honestly."), 4);
});

test('clock is mm:ss and never negative or fractional', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(9), '00:09');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(420), '07:00');
  assert.equal(formatClock(59.6), '01:00');
  assert.equal(formatClock(Number.NaN), '00:00');
  assert.equal(formatClock(-3), '00:00');
});

test('sizes and limits read as the design words them', () => {
  assert.equal(formatMB(1.44 * MB), '1.4');
  assert.equal(minutesLabel(420), '7 minutes');
  assert.equal(minutesLabel(60), '1 minute');
  assert.equal(countWord(10), 'Ten');
  assert.equal(countWord(14), '14');
});

test('audio upload: type by MIME or extension, then the size cap', () => {
  const ok = { name: 'note.m4a', type: 'audio/mp4', size: 3 * MB };
  assert.equal(checkAudioFile(ok, { maxBytes: 25 * MB }), '');
  // Some phones hand over audio with an empty or generic type.
  assert.equal(checkAudioFile({ name: 'note.MP3', type: '', size: MB }, { maxBytes: 25 * MB }), '');
  assert.match(
    checkAudioFile({ name: 'cv.pdf', type: 'application/pdf', size: MB }, { maxBytes: 25 * MB }),
    /doesn't look like an audio file/,
  );
  assert.equal(
    checkAudioFile({ name: 'long.wav', type: 'audio/wav', size: 26 * MB }, { maxBytes: 25 * MB }),
    'File is over 25 MB. Please compress it or record a shorter note.',
  );
});

test('audio length: over 7 minutes (with 2s grace) or under 10s is refused', () => {
  assert.equal(checkAudioDuration(120, LIMITS), '');
  assert.equal(checkAudioDuration(421.5, LIMITS), ''); // inside the grace
  assert.match(checkAudioDuration(423, LIMITS), /Your recording is 07:03 — the limit is 7 minutes/);
  assert.match(checkAudioDuration(9, LIMITS), /under 10 seconds/);
  // Unknown length is let through; the server decides.
  assert.equal(checkAudioDuration(Number.NaN, LIMITS), '');
  assert.equal(checkAudioDuration(Infinity, LIMITS), '');
});

test('an in-browser recording must reach the minimum', () => {
  assert.match(recordingTooShort(9, 10), /under 10 seconds/);
  assert.equal(recordingTooShort(10, 10), '');
});

test('a recording is named from the recorder MIME type', () => {
  assert.equal(voiceFileName('audio/webm;codecs=opus'), 'voice-note.webm');
  assert.equal(voiceFileName('audio/mp4'), 'voice-note.m4a');
  assert.equal(voiceFileName('audio/ogg; codecs=opus'), 'voice-note.ogg');
  assert.equal(voiceFileName(''), 'voice-note.webm');
});

test('CV: PDF or Word, under the cap', () => {
  assert.equal(checkCvFile({ name: 'Me.PDF', size: MB }, { maxBytes: 10 * MB }), '');
  assert.equal(checkCvFile({ name: 'me.docx', size: MB }, { maxBytes: 10 * MB }), '');
  assert.match(checkCvFile({ name: 'me.png', size: MB }, { maxBytes: 10 * MB }), /isn't supported/);
  assert.equal(checkCvFile({ name: 'me.pdf', size: 11 * MB }, { maxBytes: 10 * MB }), 'CV is over 10 MB.');
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
  assert.equal(
    shortWrittenMessage(questions, { w2: 'a' }),
    'Questions 1, 2, 3 need a few more words.',
  );
});

test('assessment: an index for single, a non-empty array for multi', () => {
  const questions = [{ id: 'q1' }, { id: 'q2', multi: true }, { id: 'q3' }];
  assert.equal(missingAnswersMessage(questions, { q1: 0, q2: [1], q3: 3 }), '');
  assert.equal(missingAnswersMessage(questions, { q1: 0, q2: [], q3: 2 }), 'Please answer question 2.');
  assert.equal(missingAnswersMessage(questions, {}), 'Please answer questions 1, 2, 3.');
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
  assert.deepEqual(detailProblems(full), {});
  assert.deepEqual(detailProblems({ ...full, email: 'not-an-email' }), { email: true });
  assert.deepEqual(detailProblems({ ...full, city: '   ', noticePeriod: '' }), {
    city: true,
    noticePeriod: true,
  });
});

test('a server refusal is sent back to the step that owns it', () => {
  assert.equal(stepForServerErrors({ email: 'Bad email' }).page, 'details');
  assert.deepEqual(stepForServerErrors({ w3: 'Too short' }), { page: 'written', message: 'Too short' });
  assert.equal(stepForServerErrors({ answers: 'Missing' }).page, 'assessment');
  assert.deepEqual(stepForServerErrors({ voice: 'Too long' }), { page: 'voice', message: 'Too long' });
  assert.equal(stepForServerErrors({ voiceDuration: 'x' }).page, 'voice');
  assert.deepEqual(stepForServerErrors({ cv: 'Not a CV' }), { page: 'cv', message: 'Not a CV' });
  assert.equal(stepForServerErrors({ somethingElse: 'x' }).page, 'cv');
});

test('the sales URL is written once, and the redirects never loop onto it', () => {
  assert.equal(SALES_PATH, '/recruitment/sales');
  assert.ok(SALES_REDIRECTS.includes('/recruitment/apply/sales'));
  assert.ok(!SALES_REDIRECTS.includes(SALES_PATH));
});

test('the multipart body carries exactly the agreed fields', async () => {
  const cv = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
  const voiceFile = new File(['audio'], 'voice-note.webm', { type: 'audio/webm' });
  const form = buildSalesFormData({
    role: 'sales',
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
    voice: { file: voiceFile, duration: 64.6, source: 'recorded' },
  });

  assert.deepEqual(
    [...new Set(form.keys())].sort(),
    [
      'answers', 'city', 'cv', 'email', 'experience', 'fullName', 'heardFrom',
      'noticePeriod', 'phone', 'qualification', 'role', 'sessionId', 'source',
      'telemetry', 'voice', 'voiceDuration', 'voiceSource', 'written',
    ].sort(),
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
