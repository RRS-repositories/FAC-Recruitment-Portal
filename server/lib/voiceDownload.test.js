import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRange, voiceContentType, voiceFilename } from './voiceDownload.js';

test('an audio type is served as stored', () => {
  assert.equal(voiceContentType('audio/webm'), 'audio/webm');
  assert.equal(voiceContentType('audio/webm;codecs=opus'), 'audio/webm;codecs=opus');
  assert.equal(voiceContentType(' Audio/MPEG '), 'audio/mpeg');
  assert.equal(voiceContentType('audio/x-m4a'), 'audio/x-m4a');
});

test('anything that is not audio is served as opaque bytes', () => {
  for (const stored of ['text/html', 'image/svg+xml', 'application/pdf', '', null, undefined, 42, 'audio/', 'audio/webm\r\nX-Evil: 1']) {
    assert.equal(voiceContentType(stored), 'application/octet-stream', String(stored));
  }
});

test('a filename cannot break out of its header', () => {
  assert.equal(voiceFilename('my "note".webm'), 'my note.webm');
  assert.equal(voiceFilename('..\\..\\etc/passwd'), '....etcpasswd');
  assert.equal(voiceFilename('a\r\nSet-Cookie: x.webm'), 'aSet-Cookie: x.webm');
  assert.equal(voiceFilename('Opname één.m4a'), 'Opname __n.m4a');
  assert.equal(voiceFilename('x'.repeat(400)).length, 150);
});

test('no filename, or one that sanitises to nothing, has a fallback', () => {
  assert.equal(voiceFilename(null), 'voice-note');
  assert.equal(voiceFilename(''), 'voice-note');
  assert.equal(voiceFilename('"""'), 'voice-note');
});

test('no Range header, or one we do not parse, serves the whole file', () => {
  assert.equal(parseRange(undefined, 100), null);
  assert.equal(parseRange('', 100), null);
  assert.equal(parseRange('bytes=-', 100), null);
  assert.equal(parseRange('bytes=0-1,5-9', 100), null);
  assert.equal(parseRange('items=0-5', 100), null);
});

test('a single range is honoured, clamped to the file', () => {
  assert.deepEqual(parseRange('bytes=0-', 100), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(parseRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-500', 100), { start: 0, end: 99 });
});

test('a range outside the file is unsatisfiable', () => {
  assert.equal(parseRange('bytes=100-', 100), 'unsatisfiable');
  assert.equal(parseRange('bytes=20-10', 100), 'unsatisfiable');
  assert.equal(parseRange('bytes=-0', 100), 'unsatisfiable');
  assert.equal(parseRange('bytes=0-', 0), 'unsatisfiable');
});
