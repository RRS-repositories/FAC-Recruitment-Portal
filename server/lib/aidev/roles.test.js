import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ROLE_BY_API_KEY,
  SLUG_TO_API_KEY,
  publicRolePayload,
  questionsFor,
  roleBySlug,
  writtenQuestionsFor as writtenFromRoles,
  WRITTEN_QUESTIONS,
} from '../roles.js';
import { publicQuestionsFor, writtenQuestionsFor } from '../questions.js';
import { EXTENDED_ROLES, extendedRole, isExtendedRole } from '../extendedRoles.js';
import { buildPrompt } from '../llmReview.js';
import { CANDIDATE_TZ } from '../timezone.js';
import { AIDEV_DETAIL_OPTIONS, AIDEV_QUESTIONS, AIDEV_WRITTEN_QUESTIONS } from './questions.js';

/**
 * Registering the AI Developer role, and generalising the sales role into the
 * extended-role registry, must not move any existing role by a byte.
 *
 * The sales fingerprints below are sha256 of JSON.stringify(...) taken from
 * the branch BEFORE the registry existed (c6792e1). The intern and paralegal
 * ones are pinned, from before the sales role, in ../sales/roles.test.js.
 */
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const SALES_BEFORE = {
  payload: 'ecc1d0b8519bf9031dad31b47f42ea261f9e646c17fc786608114f01aa3ce368',
  questions: '1ecec04aa6f44fc8a078f4d8aeb23a014cdc9c92d63242af3cea32857ee6bc16',
  written: '352eee60e00d8be63c1647bb54f14b31be6437fbc9a100f2e237d41f100332fa',
  role: '6f3cb0fde947a498fa2981cd544f6231c0bc58f1c6709f7489f31672523a273a',
  prompt: 'eebe56d30c174f15769d274dd835f3895e80ddf1b53f92809835c635c4254b77',
};

test('the sales payload, questions, role and model prompt are exactly what they were', () => {
  assert.equal(sha(publicRolePayload('sales')), SALES_BEFORE.payload);
  assert.equal(sha(questionsFor('sa_sales')), SALES_BEFORE.questions);
  assert.equal(sha(writtenQuestionsFor('sa_sales')), SALES_BEFORE.written);
  assert.equal(sha(roleBySlug('sales')), SALES_BEFORE.role);
  const prompt = buildPrompt({
    role: 'sa_sales',
    writtenAnswers: { w1: 'a', w6: 'b' },
    mcqAnswers: { q1: 0, q3: [0, 2] },
    cvText: 'cv',
  });
  assert.equal(sha(prompt), SALES_BEFORE.prompt);
});

test('the slugs: the three that were, plus ai-developer', () => {
  assert.deepEqual(SLUG_TO_API_KEY, {
    intern: 'india_intern',
    paralegal: 'sa_paralegal',
    sales: 'sa_sales',
    'ai-developer': 'india_aidev',
  });
});

test('the AI Developer role is registered under slug "ai-developer" and key "india_aidev"', () => {
  const role = roleBySlug('ai-developer');
  assert.deepEqual(role, {
    apiKey: 'india_aidev',
    slug: 'ai-developer',
    title: 'AI Developer',
    country: 'India',
    timezone: 'Asia/Kolkata',
  });
  assert.equal(ROLE_BY_API_KEY.india_aidev, role);
  assert.equal(roleBySlug('india_aidev'), null, 'the enum value is not a slug');
  assert.equal(questionsFor('india_aidev'), AIDEV_QUESTIONS);
  assert.equal(CANDIDATE_TZ.india_aidev, 'Asia/Kolkata');
});

test('the registry: sales then AI Developer, and nothing else counts as extended', () => {
  assert.deepEqual(EXTENDED_ROLES.map((r) => r.apiKey), ['sa_sales', 'india_aidev']);
  for (const r of EXTENDED_ROLES) {
    assert.deepEqual(Object.keys(r), [
      'apiKey', 'slug', 'title', 'country', 'timezone',
      'writtenQuestions', 'questions', 'detailOptions',
      'limits', 'publicLimits', 'hasVoice',
      'score', 'normaliseProfile', 'validateProfile', 'profileForStorage',
    ]);
    assert.ok(Object.isFrozen(r));
  }
  assert.equal(extendedRole('sa_sales').hasVoice, true);
  assert.equal(extendedRole('india_aidev').hasVoice, false);
  for (const key of ['india_intern', 'sa_paralegal', 'nope', undefined, 'constructor', '__proto__']) {
    assert.equal(extendedRole(key), null, String(key));
  }
  assert.equal(isExtendedRole(roleBySlug('ai-developer')), true);
  assert.equal(isExtendedRole(roleBySlug('sales')), true);
  assert.equal(isExtendedRole(roleBySlug('intern')), false);
  assert.equal(isExtendedRole(null), false);
});

test('writtenQuestionsFor: the AI Developer role gets its own seven', () => {
  for (const fn of [writtenQuestionsFor, writtenFromRoles]) {
    assert.equal(fn('india_aidev'), AIDEV_WRITTEN_QUESTIONS);
    assert.equal(fn('india_intern'), WRITTEN_QUESTIONS);
    assert.equal(fn('nope'), WRITTEN_QUESTIONS);
  }
  assert.deepEqual(
    AIDEV_WRITTEN_QUESTIONS.map((q) => [q.id, q.minWords]),
    [['w1', 60], ['w2', 60], ['w3', 60], ['w4', 50], ['w5', 50], ['w6', 50], ['w7', 25]],
  );
});

test('the AI Developer payload: the contract the form is built against', () => {
  const payload = publicRolePayload('ai-developer');
  assert.deepEqual(Object.keys(payload), [
    'slug', 'title', 'country', 'timezone', 'writtenQuestions', 'questions', 'limits', 'detailOptions',
  ]);
  assert.equal(payload.slug, 'ai-developer');
  assert.equal(payload.title, 'AI Developer');
  assert.equal(payload.country, 'India');
  assert.equal(payload.timezone, 'Asia/Kolkata');
  assert.equal(payload.writtenQuestions, AIDEV_WRITTEN_QUESTIONS);
  for (const q of payload.writtenQuestions) assert.deepEqual(Object.keys(q), ['id', 'label', 'minWords']);
  assert.equal(payload.questions.length, 12);
  assert.deepEqual(payload.questions, publicQuestionsFor('india_aidev'));
  assert.deepEqual(payload.limits, { cvMaxBytes: 10485760 });
  assert.equal(payload.detailOptions, AIDEV_DETAIL_OPTIONS);
  assert.deepEqual(Object.keys(payload.detailOptions), ['qualifications', 'experience', 'heardFrom', 'noticePeriods']);
});

test('no score reaches the AI Developer form, and the multi-selects are marked', () => {
  const payload = publicRolePayload('ai-developer');
  assert.equal(JSON.stringify(payload).includes('"score"'), false);
  assert.deepEqual(payload.questions.filter((q) => q.multi).map((q) => q.id), ['q3', 'q8']);
  for (const q of payload.questions) {
    assert.deepEqual(Object.keys(q), q.multi ? ['id', 'question', 'multi', 'options'] : ['id', 'question', 'options']);
    for (const o of q.options) assert.deepEqual(Object.keys(o), ['label']);
  }
});

test('the payload\'s limits are a fresh object each time; the data cannot be changed', () => {
  const a = publicRolePayload('ai-developer');
  a.limits.cvMaxBytes = 1;
  assert.equal(publicRolePayload('ai-developer').limits.cvMaxBytes, 10485760);
  assert.throws(() => {
    AIDEV_QUESTIONS[0].options[0].score = 99;
  }, TypeError);
  assert.throws(() => {
    AIDEV_DETAIL_OPTIONS.experience.push('50 years');
  }, TypeError);
});

test('the model review labels AI Developer answers with its own questions', () => {
  const answers = Object.fromEntries(AIDEV_WRITTEN_QUESTIONS.map((q, i) => [q.id, `answer number ${i + 1}`]));
  const prompt = buildPrompt({ role: 'india_aidev', writtenAnswers: answers, mcqAnswers: { q8: [0, 1] }, cvText: '' });

  assert.ok(prompt.startsWith('ROLE: AI Developer (remote, India)\n'));
  for (const [i, q] of AIDEV_WRITTEN_QUESTIONS.entries()) {
    assert.ok(prompt.includes(`Q: ${q.label}\nA: answer number ${i + 1}`), `${q.id} is labelled`);
  }
  for (const q of AIDEV_QUESTIONS) assert.ok(prompt.includes(`Q: ${q.question}\n`), q.id);
  assert.ok(prompt.includes('Chose: n8n / Make / Zapier; Node.js or Python backend with a REST API'));
  for (const q of WRITTEN_QUESTIONS) assert.ok(!prompt.includes(q.label));
  assert.doesNotMatch(prompt, /paralegal/i);
  // Weights never go to the model.
  assert.doesNotMatch(prompt, /score/i);
});
