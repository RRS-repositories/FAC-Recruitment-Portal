import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ROLE_BY_API_KEY,
  publicRolePayload,
  questionsFor,
  roleBySlug,
  writtenQuestionsFor as writtenFromRoles,
  WRITTEN_QUESTIONS,
} from '../roles.js';
import { publicQuestionsFor, writtenQuestionsFor } from '../questions.js';
import { SALES_DETAIL_OPTIONS, SALES_QUESTIONS, SALES_WRITTEN_QUESTIONS } from './questions.js';

/**
 * Registering the sales role must not move the other two by a byte.
 *
 * The fingerprints below are sha256 of JSON.stringify(...) taken from main
 * BEFORE the sales role existed (3f18e1e). If one of these fails, the form an
 * intern or paralegal candidate is served has changed -- which may be
 * intended, but must never be a side effect of this role.
 */
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const BEFORE = {
  payload: {
    intern: '278dc26ff4edfc879845c301c17c5862959980687ce0917dddaa822a6dd86160',
    paralegal: 'b05456932b5faa00733143060a4a08d413f512fb4225f7dd3a607c7a0fb9bbeb',
  },
  questions: {
    india_intern: 'd8543e66c459cffa55bad2741b03f53032d5db5282ce75dd16d19c1f00129079',
    sa_paralegal: '4c5447b4e2920bdaeedad98a2ef19431df66ddf0132625e42dd1444439f7dec0',
  },
  written: '1a6610efdf6824823d2f5ff3137d3a841fabc5b04ca535c2b55b07a47c028f5f',
};

test('the intern and paralegal payloads are exactly what they were', () => {
  for (const slug of ['intern', 'paralegal']) {
    const payload = publicRolePayload(slug);
    assert.deepEqual(Object.keys(payload), ['slug', 'title', 'country', 'timezone', 'writtenQuestions', 'questions']);
    assert.equal(sha(payload), BEFORE.payload[slug], `${slug} payload changed`);
    assert.equal(payload.writtenQuestions, WRITTEN_QUESTIONS, 'the same array, not a copy');
    assert.equal('limits' in payload, false);
    assert.equal('detailOptions' in payload, false);
  }
});

test('the intern and paralegal questions, with weights, are exactly what they were', () => {
  for (const apiKey of ['india_intern', 'sa_paralegal']) {
    assert.equal(sha(questionsFor(apiKey)), BEFORE.questions[apiKey], `${apiKey} questions changed`);
  }
  assert.equal(sha(WRITTEN_QUESTIONS), BEFORE.written);
});

test('writtenQuestionsFor: sales gets its own six, everyone else the shared three', () => {
  for (const fn of [writtenQuestionsFor, writtenFromRoles]) {
    assert.equal(fn('sa_sales'), SALES_WRITTEN_QUESTIONS);
    assert.equal(fn('india_intern'), WRITTEN_QUESTIONS);
    assert.equal(fn('sa_paralegal'), WRITTEN_QUESTIONS);
    // Anything unknown falls back to the shared list, as every caller did
    // before this function existed.
    assert.equal(fn('nope'), WRITTEN_QUESTIONS);
    assert.equal(fn(undefined), WRITTEN_QUESTIONS);
  }
  assert.deepEqual(
    SALES_WRITTEN_QUESTIONS.map((q) => [q.id, q.minWords]),
    [['w1', 60], ['w2', 60], ['w3', 50], ['w4', 40], ['w5', 40], ['w6', 30]],
  );
});

test('the sales role is registered under slug "sales" and key "sa_sales"', () => {
  const role = roleBySlug('sales');
  assert.deepEqual(role, {
    apiKey: 'sa_sales',
    slug: 'sales',
    title: 'Sales & Customer Service',
    country: 'South Africa',
    timezone: 'Africa/Johannesburg',
  });
  assert.equal(ROLE_BY_API_KEY.sa_sales, role);
  assert.equal(roleBySlug('sa_sales'), null, 'the enum value is not a slug');
  assert.equal(questionsFor('sa_sales'), SALES_QUESTIONS);
});

test('the sales payload: its own questions without weights, limits and dropdowns', () => {
  const payload = publicRolePayload('sales');
  assert.deepEqual(Object.keys(payload), [
    'slug',
    'title',
    'country',
    'timezone',
    'writtenQuestions',
    'questions',
    'limits',
    'detailOptions',
  ]);
  assert.equal(payload.slug, 'sales');
  assert.equal(payload.writtenQuestions, SALES_WRITTEN_QUESTIONS);
  assert.deepEqual(payload.questions, publicQuestionsFor('sa_sales'));
  assert.deepEqual(payload.limits, {
    cvMaxBytes: 10485760,
    voiceMaxBytes: 26214400,
    voiceMaxSeconds: 420,
    voiceMinSeconds: 10,
  });
  assert.deepEqual(Object.keys(payload.detailOptions), ['qualifications', 'experience', 'heardFrom', 'noticePeriods']);
  assert.equal(payload.detailOptions, SALES_DETAIL_OPTIONS);
});

test('no score reaches the sales form, and the multi-selects are marked', () => {
  const json = JSON.stringify(publicRolePayload('sales'));
  assert.equal(json.includes('"score"'), false);
  const multi = publicRolePayload('sales').questions.filter((q) => q.multi).map((q) => q.id);
  assert.deepEqual(multi, ['q3', 'q7']);
});

test('the sales data cannot be changed by a caller', () => {
  assert.throws(() => {
    SALES_QUESTIONS[0].options[0].score = 99;
  }, TypeError);
  assert.throws(() => {
    SALES_DETAIL_OPTIONS.experience.push('50 years');
  }, TypeError);
});
