import test from 'node:test';
import assert from 'node:assert/strict';

import { countsAsTyping } from './useTelemetry.js';

/**
 * What counts as somebody typing.
 *
 * This replaced a `keydown` listener that filtered on `event.key.length !== 1`
 * and therefore recorded NOTHING on a phone, where the key is reported as
 * 'Unidentified'. On 240 live applications that was 150 of 197 mobile
 * applicants with zero typed characters, against 2 of 43 on desktop -- and
 * 82% of this pool applies from a phone. Typing speed could only ever count
 * against a desktop applicant, so two candidates were judged by different
 * signals.
 */

test('ordinary typing counts, on a keyboard or a phone', () => {
  for (const type of [
    'insertText', // desktop, and most mobile keyboards
    'insertCompositionText', // Android predictive input mid-word
    'insertFromComposition', // the commit at the end of it
    'insertReplacementText', // autocorrect swapping a word
    'insertLineBreak',
    'insertParagraph',
  ]) {
    assert.equal(countsAsTyping(type), true, type);
  }
});

test('pasting is never counted as typing', () => {
  // The expensive one to get wrong. `insertFromPaste` carries the whole
  // pasted string, so counting it would look like 900 characters typed in an
  // instant -- which is exactly what the typing-speed signal punishes. Paste
  // is already counted separately, by onPaste.
  for (const type of ['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop']) {
    assert.equal(countsAsTyping(type), false, type);
  }
});

test('deleting and undoing are not typing', () => {
  for (const type of [
    'deleteContentBackward',
    'deleteContentForward',
    'deleteByCut',
    'deleteWordBackward',
    'historyUndo',
    'historyRedo',
  ]) {
    assert.equal(countsAsTyping(type), false, type);
  }
});

test('a browser that reports no inputType still counts', () => {
  // Discarding these would quietly reproduce the very bug this replaced.
  assert.equal(countsAsTyping(''), true);
});

test('anything unrecognised or malformed does not count', () => {
  for (const bad of [null, undefined, 0, {}, [], 'formatBold', 'nonsense']) {
    assert.equal(countsAsTyping(bad), false, JSON.stringify(bad));
  }
});
