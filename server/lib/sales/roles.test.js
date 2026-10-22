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
 * The fingerprints below were taken from main BEFORE the sales role existed
 * (3f18e1e) and re-pinned on 22 Oct 2026, when the firm was renamed to Beacon
 * Legal Group: one written question names the firm, so the payload and question
 * hashes moved with it. WRITTEN_QUESTIONS did not move -- the shared three
 * never named the firm, which is why its pin below is still the original.
 *
 * If one of these fails, the form an intern or paralegal candidate is served
 * has changed -- which may be intended, but must never be a side effect of
 * another role.
 */
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const BEFORE = {
  payload: {
    intern: '4936a1d7747871744c8e048ce18d0ccf8be79eb897cfe088560921ae426f9e3e',
    paralegal: 'c02600c301af8406ae367616388bb2f81b96f398da84c15a18182f120020bc97',
  },
  questions: {
    india_intern: '0a6b1ac3d833d928dbdfd3f52ed1a7f45bb27abb99f01e42ae839518436669ad',
    sa_paralegal: '0fac0bcd6a9baeb4493fdc87819b4011384f0c10f2eabff7d0aa2b3dc3dcc681',
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
