import test from 'node:test';
import assert from 'node:assert/strict';

import { unwrapJson, llmMode } from './llm.js';

/**
 * Gemma returns its JSON inside a ```json fence even when asked for `format:
 * 'json'`. That is not a hypothetical: it failed every review the first time
 * this was pointed at a real model, so these cases are the ones that actually
 * happened plus the ones that plausibly will.
 */

test('a ```json fence is stripped', () => {
  const wrapped = '```json\n{"fitment_score": 72}\n```';
  assert.deepEqual(JSON.parse(unwrapJson(wrapped)), { fitment_score: 72 });
});

test('a bare ``` fence is stripped too', () => {
  assert.deepEqual(JSON.parse(unwrapJson('```\n{"a":1}\n```')), { a: 1 });
});

test('plain JSON is returned untouched', () => {
  assert.deepEqual(JSON.parse(unwrapJson('{"a":1}')), { a: 1 });
  assert.deepEqual(JSON.parse(unwrapJson('  {"a":1}  ')), { a: 1 });
});

test('prose either side of the object is discarded', () => {
  const chatty = 'Here is my assessment:\n{"a":1, "b":"}"}\nI hope that helps.';
  assert.deepEqual(JSON.parse(unwrapJson(chatty)), { a: 1, b: '}' });
});

test('an array reply survives', () => {
  assert.deepEqual(JSON.parse(unwrapJson('```json\n[1,2]\n```')), [1, 2]);
});

test('something with no JSON in it is handed back, not invented', () => {
  // The caller turns this into a retry. Guessing a shape here would be worse
  // than failing: a fabricated score is not a score.
  const junk = 'I cannot assess this application.';
  assert.equal(unwrapJson(junk), junk);
  assert.throws(() => JSON.parse(unwrapJson(junk)));
});

test('the model is off unless a key is set', () => {
  const had = process.env.OLLAMA_API_KEY;
  delete process.env.OLLAMA_API_KEY;
  assert.equal(llmMode(), 'off');
  process.env.OLLAMA_API_KEY = 'x';
  assert.equal(llmMode(), 'on');
  if (had === undefined) delete process.env.OLLAMA_API_KEY;
  else process.env.OLLAMA_API_KEY = had;
});
