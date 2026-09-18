import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chosenLabels,
  isSalesApplicant,
  voiceExtension,
  voiceNoteFilename,
  wordCount,
} from './salesDetail.js';

test('only sales applicants are sales applicants', () => {
  assert.equal(isSalesApplicant({ role: 'sales' }), true);
  assert.equal(isSalesApplicant({ role: 'sa_sales' }), true);
  assert.equal(isSalesApplicant({ role: 'intern' }), false);
  assert.equal(isSalesApplicant({ role: 'paralegal' }), false);
  assert.equal(isSalesApplicant(null), false);
});

test('the saved voice note is named after the applicant', () => {
  assert.equal(voiceNoteFilename('Jane  Doe', { filename: 'rec.webm' }), 'Jane_Doe_voice-note.webm');
  assert.equal(voiceNoteFilename('A/B: C', { mime: 'audio/mpeg' }), 'AB_C_voice-note.mp3');
  assert.equal(voiceNoteFilename('', null), 'applicant_voice-note.webm');
});

test('the extension comes from the filename, then the MIME type', () => {
  assert.equal(voiceExtension({ filename: 'note.M4A', mime: 'audio/webm' }), 'm4a');
  assert.equal(voiceExtension({ mime: 'audio/webm;codecs=opus' }), 'webm');
  assert.equal(voiceExtension({ mime: 'audio/ogg; codecs=opus' }), 'ogg');
  assert.equal(voiceExtension({ mime: 'audio/x-wav' }), 'wav');
  assert.equal(voiceExtension({ mime: 'audio/mp4' }), 'm4a');
  assert.equal(voiceExtension({}), 'webm');
});

test('assessment answers are option indexes, single or multi', () => {
  const question = { id: 'q1', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] };
  assert.deepEqual(chosenLabels(question, 1), ['B']);
  assert.deepEqual(chosenLabels(question, 0), ['A']);
  assert.deepEqual(chosenLabels(question, [0, 2]), ['A', 'C']);
  assert.deepEqual(chosenLabels(question, [7]), []);
  assert.deepEqual(chosenLabels(question, undefined), []);
  assert.deepEqual(chosenLabels(question, null), []);
});

test('words are counted, not characters', () => {
  assert.equal(wordCount('  one two\nthree  '), 3);
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount(undefined), 0);
});
