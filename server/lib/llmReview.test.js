import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt, parseReview, foldAiOpinion, PROMPT_VERSION } from './llmReview.js';
import { questionsFor, writtenQuestionsFor, ROLE_BY_API_KEY, WRITTEN_QUESTIONS } from './roles.js';

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

/*
 * The prompt builder as it was before per-role written questions, copied
 * verbatim. The two original roles must still get exactly this, byte for
 * byte: PROMPT_VERSION did not move, so a review before and after the Sales
 * role was added has to have been asked the same thing.
 */
function promptBeforeSales({ role, writtenAnswers, mcqAnswers, cvText }) {
  const roleMeta = ROLE_BY_API_KEY[role] ?? null;
  const questions = questionsFor(role) ?? [];

  const written = WRITTEN_QUESTIONS.map((q) => {
    const answer = String(writtenAnswers?.[q.id] ?? '').trim();
    return `Q: ${q.label}\nA: ${answer || '(left blank)'}`;
  }).join('\n\n');

  const mcq = questions
    .map((q) => {
      const given = mcqAnswers?.[q.id];
      const picked = (Array.isArray(given) ? given : [given])
        .filter((i) => i !== undefined && i !== null)
        .map((i) => q.options?.[i]?.label)
        .filter(Boolean);
      return `Q: ${q.question}\nChose: ${picked.length ? picked.join('; ') : '(no answer)'}`;
    })
    .join('\n\n');

  return `ROLE: ${roleMeta?.title ?? role}${roleMeta?.country ? ` (remote, ${roleMeta.country})` : ''}

--- THEIR CV ---
${cvText || '(no CV text was available — judge on the answers alone, and say so in the summary)'}

--- WRITTEN ANSWERS ---
${written}

--- MULTIPLE CHOICE ---
${mcq}`;
}

test('the two original roles get a byte-identical prompt to before', () => {
  const inputs = [
    { writtenAnswers: ANSWERS, mcqAnswers: { q1: 0, q2: [0, 1] }, cvText: 'CV text here' },
    { writtenAnswers: {}, mcqAnswers: {}, cvText: '' },
    { writtenAnswers: { w1: '  padded  ', w9: 'not asked' }, mcqAnswers: { q1: 99 }, cvText: 'x' },
  ];
  for (const role of ['india_intern', 'sa_paralegal']) {
    for (const input of inputs) {
      assert.equal(buildPrompt({ role, ...input }), promptBeforeSales({ role, ...input }), role);
    }
  }
});

test('sales answers are labelled with the sales written questions', () => {
  const questions = writtenQuestionsFor('sa_sales');
  assert.ok(questions.length > 0, 'the sales role has written questions');
  const answers = Object.fromEntries(questions.map((q, i) => [q.id, `answer number ${i + 1}`]));
  const prompt = buildPrompt({ role: 'sa_sales', writtenAnswers: answers, mcqAnswers: {}, cvText: '' });

  for (const [i, q] of questions.entries()) {
    assert.ok(prompt.includes(`Q: ${q.label}\nA: answer number ${i + 1}`), `${q.id} is labelled`);
  }
  // None of the paralegal written questions leak into a sales prompt.
  for (const q of WRITTEN_QUESTIONS) {
    if (!questions.some((s) => s.label === q.label)) assert.ok(!prompt.includes(q.label));
  }
  assert.doesNotMatch(prompt, /paralegal/i);
});
