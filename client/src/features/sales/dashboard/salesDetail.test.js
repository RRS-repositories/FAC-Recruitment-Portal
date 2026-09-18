import test from 'node:test';
import assert from 'node:assert/strict';

import { SALES_FIELDS, isSalesApplicant, voiceExtension, voiceNoteFilename } from './salesDetail.js';

test('only sales applicants are sales applicants', () => {
  assert.equal(isSalesApplicant({ role: 'sales' }), true);
  assert.equal(isSalesApplicant({ role: 'sa_sales' }), true);
  assert.equal(isSalesApplicant({ role: 'intern' }), false);
  assert.equal(isSalesApplicant({ role: 'paralegal' }), false);
  assert.equal(isSalesApplicant({ role: 'ai-developer' }), false);
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

test('the sales Details section shows the five profile fields, in order, as text', () => {
  assert.deepEqual(
    SALES_FIELDS.map((field) => [field.key, field.label]),
    [
      ['city', 'City'],
      ['qualification', 'Qualification'],
      ['experience', 'Experience'],
      ['heardFrom', 'Heard about us'],
      ['noticePeriod', 'Notice period'],
    ],
  );
  assert.equal(SALES_FIELDS.some((field) => field.kind), false);
});
