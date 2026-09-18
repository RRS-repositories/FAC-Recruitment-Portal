import test from 'node:test';
import assert from 'node:assert/strict';

import { chosenLabels, externalHref, questionText, wordCount } from './detailFormat.js';
import { AI_DEV_FIELDS, isAiDevApplicant } from './aiDevDetail.js';
import { hasRoleDetails, roleDetailsKind } from './roleDetails.js';

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

test('a question is worded from `question`, then `label`, never blank', () => {
  assert.equal(questionText({ id: 'q1', question: 'Asked', label: 'Label' }), 'Asked');
  assert.equal(questionText({ id: 'q1', label: 'Label' }), 'Label');
  assert.equal(questionText({ id: 'q1' }), 'q1');
});

test('only http and https become links', () => {
  assert.equal(externalHref('https://github.com/someone'), 'https://github.com/someone');
  assert.equal(externalHref('  http://example.test/me  '), 'http://example.test/me');
  assert.equal(externalHref('javascript:alert(1)'), null);
  assert.equal(externalHref('JavaScript:alert(1)'), null);
  assert.equal(externalHref('data:text/html,<b>x</b>'), null);
  assert.equal(externalHref('github.com/someone'), null);
  assert.equal(externalHref('//evil.test'), null);
  assert.equal(externalHref(''), null);
  assert.equal(externalHref(undefined), null);
  assert.equal(externalHref(42), null);
});

test('AI developer rows are recognised by slug or enum, and nothing else is', () => {
  assert.equal(isAiDevApplicant({ role: 'ai-developer' }), true);
  assert.equal(isAiDevApplicant({ role: 'india_aidev' }), true);
  assert.equal(isAiDevApplicant({ role: 'intern' }), false);
  assert.equal(isAiDevApplicant({ role: 'sales' }), false);
  assert.equal(isAiDevApplicant(null), false);
});

test('the AI developer Details section, in order, with GitHub as the only link', () => {
  assert.deepEqual(
    AI_DEV_FIELDS.map((field) => field.key),
    ['city', 'qualification', 'experience', 'githubUrl', 'employer', 'heardFrom', 'noticePeriod'],
  );
  assert.deepEqual(
    AI_DEV_FIELDS.filter((field) => field.kind === 'link').map((field) => field.key),
    ['githubUrl'],
  );
});

test('intern and paralegal keep their own block; sales and AI dev get a panel', () => {
  assert.equal(roleDetailsKind({ role: 'intern' }), null);
  assert.equal(roleDetailsKind({ role: 'paralegal' }), null);
  assert.equal(roleDetailsKind({ role: 'india_intern' }), null);
  assert.equal(roleDetailsKind({ role: 'sa_paralegal' }), null);
  assert.equal(roleDetailsKind({ role: 'sales' }), 'sales');
  assert.equal(roleDetailsKind({ role: 'sa_sales' }), 'sales');
  assert.equal(roleDetailsKind({ role: 'ai-developer' }), 'aidev');
  assert.equal(roleDetailsKind({ role: 'india_aidev' }), 'aidev');
  assert.equal(hasRoleDetails({ role: 'intern' }), false);
  assert.equal(hasRoleDetails({ role: 'ai-developer' }), true);
});
