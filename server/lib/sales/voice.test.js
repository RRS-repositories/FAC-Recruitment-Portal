import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * The voice note: what counts as audio, what counts as a believable duration,
 * and where it ends up.
 *
 * The storage root is read once, when storage.js is first imported, so it is
 * pointed at a throwaway directory before anything is imported. Nothing here
 * touches the real CV store.
 */
const root = await mkdtemp(path.join(os.tmpdir(), 'fac-voice-test-'));
process.env.CV_STORAGE_DIR = root;
test.after(() => rm(root, { recursive: true, force: true }));

const { UploadError } = await import('../storage.js');
const {
  VOICE_MESSAGES,
  VoiceUploadError,
  checkVoiceFile,
  deleteVoice,
  detectAudio,
  parseVoiceDuration,
  storeVoice,
  validateVoiceMeta,
} = await import('./voice.js');

const pad = (head, length = 64) => Buffer.concat([Buffer.from(head), Buffer.alloc(length)]);

const SAMPLES = {
  webm: pad([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, ...Buffer.from('webm')]),
  mka: pad([0x1a, 0x45, 0xdf, 0xa3, 0xa3, 0x42, 0x82, 0x88, ...Buffer.from('matroska')]),
  ogg: pad(Buffer.from('OggS')),
  wav: pad([...Buffer.from('RIFF'), 0x24, 0x08, 0x00, 0x00, ...Buffer.from('WAVEfmt ')]),
  m4a: pad([0x00, 0x00, 0x00, 0x20, ...Buffer.from('ftypM4A ')]),
  mp3Id3: pad(Buffer.from('ID3\x04\x00')),
  mp3Frame: pad([0xff, 0xfb, 0x90, 0x64]),
  mp3Mpeg2: pad([0xff, 0xf3, 0x90, 0x64]),
  aacNoCrc: pad([0xff, 0xf1, 0x50, 0x80]),
  aacMpeg2: pad([0xff, 0xf9, 0x50, 0x80]),
};

test('each audio container is recognised by its first bytes', () => {
  const expected = {
    webm: ['.webm', 'audio/webm'],
    mka: ['.mka', 'audio/x-matroska'],
    ogg: ['.ogg', 'audio/ogg'],
    wav: ['.wav', 'audio/wav'],
    m4a: ['.m4a', 'audio/mp4'],
    mp3Id3: ['.mp3', 'audio/mpeg'],
    mp3Frame: ['.mp3', 'audio/mpeg'],
    mp3Mpeg2: ['.mp3', 'audio/mpeg'],
    aacNoCrc: ['.aac', 'audio/aac'],
    aacMpeg2: ['.aac', 'audio/aac'],
  };
  for (const [name, [ext, contentType]] of Object.entries(expected)) {
    assert.deepEqual(detectAudio(SAMPLES[name]), { ext, contentType }, name);
  }
});

test('ADTS AAC and MP3 frames are told apart by their layer bits', () => {
  // 0xFFF1: layer 00 → AAC. 0xFFFB: layer 01 → MPEG-1 Layer III.
  assert.equal(detectAudio(pad([0xff, 0xf1]))?.ext, '.aac');
  assert.equal(detectAudio(pad([0xff, 0xfb]))?.ext, '.mp3');
});

test('things that are not audio are refused, whatever they are called', () => {
  const notAudio = {
    pdf: pad(Buffer.from('%PDF-1.4')),
    zip: pad([0x50, 0x4b, 0x03, 0x04]),
    exe: pad(Buffer.from('MZ')),
    png: pad([0x89, 0x50, 0x4e, 0x47]),
    riffNotWave: pad([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('AVI ')]),
    text: Buffer.from('hello, this is plainly text and not a recording'),
    ffButNoSync: pad([0xff, 0x00]),
    tiny: Buffer.from([0x1a, 0x45]),
    empty: Buffer.alloc(0),
  };
  for (const [name, buffer] of Object.entries(notAudio)) {
    assert.equal(detectAudio(buffer), null, name);
  }
  assert.equal(detectAudio('OggS not a buffer'), null);
  assert.equal(detectAudio(undefined), null);
});

test('checkVoiceFile: missing, empty, too large, not audio, fine', () => {
  assert.equal(checkVoiceFile(undefined), VOICE_MESSAGES.missing);
  assert.equal(VOICE_MESSAGES.missing, 'Please add your voice note.');
  assert.equal(checkVoiceFile({ buffer: Buffer.alloc(0) }), VOICE_MESSAGES.empty);
  assert.equal(checkVoiceFile({ buffer: pad(Buffer.from('OggS'), 25 * 1024 * 1024) }), VOICE_MESSAGES.tooLarge);
  assert.equal(checkVoiceFile({ buffer: pad(Buffer.from('%PDF')) }), VOICE_MESSAGES.notAudio);
  assert.equal(checkVoiceFile({ buffer: SAMPLES.ogg }), null);
  // Exactly 25 MB is allowed; one byte more is not.
  assert.equal(checkVoiceFile({ buffer: pad(Buffer.from('OggS'), 25 * 1024 * 1024 - 4) }), null);
});

test('duration: only a plain whole number of seconds', () => {
  assert.equal(parseVoiceDuration('45'), 45);
  assert.equal(parseVoiceDuration(45), 45);
  assert.equal(parseVoiceDuration('0'), 0);
  for (const bad of ['12.5', '1e2', ' 12', '12 ', '-5', '', 'abc', '0x10', '123456', 12.5, NaN, null, undefined, {}, []]) {
    assert.equal(parseVoiceDuration(bad), null, JSON.stringify(bad));
  }
});

test('duration must be 10 seconds to 7 minutes, with two seconds of grace', () => {
  const ok = (duration) => validateVoiceMeta({ duration, source: 'recorded' });
  assert.deepEqual(ok('10'), { durationSec: 10, source: 'recorded' });
  assert.deepEqual(ok('420'), { durationSec: 420, source: 'recorded' });
  assert.deepEqual(ok('422'), { durationSec: 422, source: 'recorded' });
  assert.deepEqual(ok('9'), { error: VOICE_MESSAGES.tooShort });
  assert.deepEqual(ok('0'), { error: VOICE_MESSAGES.tooShort });
  assert.deepEqual(ok('423'), { error: VOICE_MESSAGES.tooLong });
  assert.deepEqual(ok(undefined), { error: VOICE_MESSAGES.duration });
  assert.deepEqual(ok('4.5'), { error: VOICE_MESSAGES.duration });
});

test("source must be 'recorded' or 'uploaded'", () => {
  assert.deepEqual(validateVoiceMeta({ duration: '60', source: 'uploaded' }), { durationSec: 60, source: 'uploaded' });
  // An uploaded file whose length the browser could not read: accepted, length unknown.
  assert.deepEqual(validateVoiceMeta({ duration: '0', source: 'uploaded' }), { durationSec: null, source: 'uploaded' });
  // A recording made in the form always has a length, so 0 is still refused.
  assert.deepEqual(validateVoiceMeta({ duration: '0', source: 'recorded' }), { error: VOICE_MESSAGES.tooShort });
  for (const source of ['Recorded', 'file', '', undefined, ['recorded']]) {
    assert.deepEqual(validateVoiceMeta({ duration: '60', source }), { error: VOICE_MESSAGES.source }, String(source));
  }
});

test('the messages say what to do, in the words the form shows', () => {
  assert.match(VOICE_MESSAGES.tooLarge, /25 MB/);
  assert.match(VOICE_MESSAGES.tooShort, /10 seconds/);
  assert.match(VOICE_MESSAGES.tooLong, /7 minutes/);
});

test('a voice refusal is an UploadError the route reports under "voice"', () => {
  const error = new VoiceUploadError('x');
  assert.ok(error instanceof UploadError);
  assert.equal(error.field, 'voice');
  // A CV refusal has no field, and so is still reported under "cv".
  assert.equal(new UploadError('y').field, undefined);
});

test('storeVoice files it next to the CV, named by what the bytes are', async () => {
  const applicantId = '0b7a2f4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
  const stored = await storeVoice({ applicantId, originalName: 'my-note.mp3', buffer: SAMPLES.webm });

  // The extension comes from the content: a WebM called .mp3 is stored as .webm.
  assert.deepEqual(stored, {
    key: `${applicantId}/voice.webm`,
    bytes: SAMPLES.webm.length,
    contentType: 'audio/webm',
    filename: 'my-note.mp3',
  });
  const full = path.join(root, applicantId, 'voice.webm');
  assert.deepEqual(await readFile(full), SAMPLES.webm);
  if (process.platform !== 'win32') assert.equal((await stat(full)).mode & 0o777, 0o640);

  assert.equal(await deleteVoice(stored.key), true);
  await assert.rejects(stat(full));
});

test('a recording with no real name gets a sensible one', async () => {
  const applicantId = '1b7a2f4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
  for (const originalName of [undefined, '', 'blob']) {
    const stored = await storeVoice({ applicantId, originalName, buffer: SAMPLES.m4a });
    assert.equal(stored.filename, 'voice-note.m4a');
  }
  const long = await storeVoice({ applicantId, originalName: `${'a'.repeat(300)}.wav`, buffer: SAMPLES.wav });
  assert.equal(long.filename.length, 255);
});

test('storeVoice refuses what checkVoiceFile refuses, and writes nothing', async () => {
  const applicantId = '2b7a2f4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
  await assert.rejects(
    storeVoice({ applicantId, originalName: 'x.webm', buffer: pad(Buffer.from('%PDF')) }),
    (error) => error instanceof VoiceUploadError && error.message === VOICE_MESSAGES.notAudio,
  );
  await assert.rejects(stat(path.join(root, applicantId)));
});

test('an applicant id that tries to leave the storage root is refused', async () => {
  await assert.rejects(
    storeVoice({ applicantId: '../../escape', originalName: 'x.ogg', buffer: SAMPLES.ogg }),
    UploadError,
  );
  await assert.rejects(storeVoice({ applicantId: '', buffer: SAMPLES.ogg }));
});
