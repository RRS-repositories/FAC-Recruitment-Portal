import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendVoice,
  checkAudioDuration,
  checkAudioFile,
  formatClock,
  minutesLabel,
  recordingTooShort,
  voiceFileName,
} from './voiceHelpers.js';

const MB = 1024 * 1024;
const LIMITS = { minSeconds: 10, maxSeconds: 420 };

test('clock is mm:ss and never negative or fractional', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(9), '00:09');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(420), '07:00');
  assert.equal(formatClock(59.6), '01:00');
  assert.equal(formatClock(Number.NaN), '00:00');
  assert.equal(formatClock(-3), '00:00');
});

test('limits read as the design words them', () => {
  assert.equal(minutesLabel(420), '7 minutes');
  assert.equal(minutesLabel(60), '1 minute');
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

test('the voice note adds its three fields, or nothing without a note', () => {
  const empty = new FormData();
  appendVoice(empty, null);
  assert.deepEqual([...empty.keys()], []);

  const form = new FormData();
  const file = new File(['audio'], 'take.m4a', { type: 'audio/mp4' });
  appendVoice(form, { file, duration: 64.6, source: 'uploaded' });
  assert.deepEqual([...form.keys()], ['voice', 'voiceDuration', 'voiceSource']);
  assert.equal(form.get('voice').name, 'take.m4a');
  assert.equal(form.get('voiceDuration'), '65');
  assert.equal(form.get('voiceSource'), 'uploaded');
});
