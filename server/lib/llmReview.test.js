import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt, parseReview, foldAiOpinion, PROMPT_VERSION } from './llmReview.js';
import { questionsFor } from './roles.js';

/**
 * The parts that decide something, tested without a model or a database.
 *
 * What is worth pinning here is not "does it call the API" — it is the two
 * rules the feature rests on: the model must not be shown the marking weights,
 * and its opinion about AI use must not be able to convict anyone on its own.
 */

const ANSWERS = { w1: 'I have worked on injury files for two years.', w2: 'Because I want to.', w3: '' };

test('the prompt never carries the marking weights', () => {
  const questions = questionsFor('india_intern');
  const prompt = buildPrompt({
    role: 'india_intern',
    writtenAnswers: ANSWERS,
    mcqAnswers: { q1: 0, q2: [0, 1] },
    cvText: 'CV text here',
  });

  // Every option's score, in the form it is stored. If any leaks, the model can
  // re-derive the rule score and the two numbers stop being independent.
  for (const q of questions) {
    for (const option of q.options ?? []) {
      assert.ok(
        !prompt.includes(`"score":${option.score}`) && !prompt.includes(`score: ${option.score}`),
        `prompt leaked a weight from ${q.id}`,
      );
    }
  }
  assert.ok(!/\bscore\b/i.test(prompt), 'the prompt should not mention scoring at all');
});

test('the prompt carries the chosen option labels, not their indexes', () => {
  const questions = questionsFor('india_intern');
  const firstLabel = questions[0].options[0].label;
  const prompt = buildPrompt({
    role: 'india_intern',
    writtenAnswers: ANSWERS,
    mcqAnswers: { q1: 0 },
    cvText: '',
  });
  assert.ok(prompt.includes(firstLabel), 'the label they chose should be readable');
});

test('a missing CV is stated rather than left as an empty gap', () => {
  const prompt = buildPrompt({ role: 'india_intern', writtenAnswers: ANSWERS, mcqAnswers: {}, cvText: '' });
  assert.match(prompt, /no CV text was available/i);
});

test('an unanswered written question is marked, not silently blank', () => {
  const prompt = buildPrompt({ role: 'india_intern', writtenAnswers: ANSWERS, mcqAnswers: {}, cvText: 'x' });
  assert.match(prompt, /\(left blank\)/);
});

test('scores are clamped into range', () => {
  assert.equal(parseReview({ fitment_score: 140, ai_opinion: 'unlikely' }).fitmentScore, 100);
  assert.equal(parseReview({ fitment_score: -20, ai_opinion: 'unlikely' }).fitmentScore, 0);
  assert.equal(parseReview({ fitment_score: '73', ai_opinion: 'unlikely' }).fitmentScore, 73);
});

test('a score that is not a number is refused, not coerced to zero', () => {
  // Silently scoring somebody 0 because the model returned a word would be far
  // worse than failing the review and saying so.
  assert.throws(() => parseReview({ fitment_score: 'strong', ai_opinion: 'unlikely' }));
});

test('an unrecognised ai_opinion reads as unclear, never as a verdict', () => {
  assert.equal(parseReview({ fitment_score: 50, ai_opinion: 'definitely' }).aiOpinion, 'unclear');
  assert.equal(parseReview({ fitment_score: 50 }).aiOpinion, 'unclear');
  assert.equal(parseReview({ fitment_score: 50, ai_opinion: 'LIKELY' }).aiOpinion, 'likely');
});

test('the model alone cannot push a clean application past "possible"', () => {
  // Spec §13.3: a text-only judgement about fluent non-native writers must not
  // be able to convict on its own. 15 points cannot cross the 30-point line.
  const clean = { level: 'clean', score: 0, reasons: [], mechanical: false };
  const after = foldAiOpinion(clean, { aiOpinion: 'likely', aiRationale: 'no personal detail' });
  assert.equal(after.level, 'possible', 'a reason to look');
  assert.notEqual(after.level, 'ai_used', 'never a verdict on the text alone');
  assert.ok(after.score < 30, 'and it barely moves the score');
});

test('but it can tip one that behaviour had already put near the line', () => {
  // mechanical: they pasted. That is what lets the model's agreement convict --
  // two judges, two kinds of evidence.
  const near = { level: 'possible', score: 45, reasons: ['Pasted 300 characters'], mechanical: true };
  const after = foldAiOpinion(near, { aiOpinion: 'likely', aiRationale: 'register changes sharply' });
  assert.equal(after.score, 60);
  assert.equal(after.level, 'ai_used');
  assert.equal(after.reasons.length, 2, 'the original behavioural reason must survive');
  assert.match(after.reasons[1], /register changes sharply/);
});

test('anything other than "likely" changes nothing at all', () => {
  const before = { level: 'possible', score: 45, reasons: ['Pasted 300 characters'] };
  for (const opinion of ['unclear', 'unlikely']) {
    assert.deepEqual(foldAiOpinion(before, { aiOpinion: opinion, aiRationale: 'x' }), before);
  }
});

test('the prompt version is a number, so a stored review can be traced to its wording', () => {
  assert.equal(typeof PROMPT_VERSION, 'number');
});
