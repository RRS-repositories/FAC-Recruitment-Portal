import test from 'node:test';
import assert from 'node:assert/strict';

import { describeTemplates, getTemplate, templateKeys } from '../lib/templates.js';
import { TEMPLATE_COUNT } from './index.js';
import { notifyDecision } from '../lib/notify.js';

/**
 * The AI Developer decision emails, pinned the way the Sales pair is
 * (salesTemplates.test.js): each renders its own preview, neither borrows
 * another role's copy, both say on the templates screen that they are drafts,
 * and an AI Developer decision queues an AI Developer email.
 */

const AIDEV = ['recruit.aidev.accept', 'recruit.aidev.decline'];

test('TEMPLATE_COUNT covers the two new templates', () => {
  assert.equal(TEMPLATE_COUNT, 21);
  assert.equal(templateKeys().length, TEMPLATE_COUNT);
  for (const key of AIDEV) assert.ok(templateKeys().includes(key), key);
});

for (const key of AIDEV) {
  test(`${key} renders its own sample without error`, () => {
    const entry = describeTemplates().find((t) => t.key === key);
    assert.ok(entry, `${key} is registered`);
    assert.equal(entry.error, null);
    assert.ok(entry.preview.subject && entry.preview.text && entry.preview.html);
  });

  test(`${key} names the AI Developer position and no other role`, () => {
    const tpl = getTemplate(key);
    const out = tpl.render(tpl.sample);
    for (const part of [out.subject, out.text, out.html, tpl.title, tpl.description]) {
      assert.doesNotMatch(part, /paralegal|internship|internshala|sales|customer service/i);
    }
    assert.match(out.text, /the AI Developer position at Fast Action Claims/);
    assert.match(out.text, /^Dear Arjun,/, 'its own invented sample');
  });

  test(`${key} is labelled a draft on the templates screen`, () => {
    const tpl = getTemplate(key);
    assert.match(tpl.title, /AI Developer \(DRAFT — wording on hold\)$/);
    assert.match(tpl.description, /DRAFT — wording on hold/);
  });
}

test('the accept email carries the booking link and gives times in IST', () => {
  const tpl = getTemplate('recruit.aidev.accept');
  const out = tpl.render({ ...tpl.sample, token: 'TOKEN-123' });
  assert.match(out.text, /\/book\/TOKEN-123/);
  assert.match(out.html, /\/book\/TOKEN-123/);
  assert.match(out.text, /shown in your local time \(IST\)/);
  assert.equal(out.subject, 'Fast Action Claims — Interview invitation');
});

test('the decline email is built like the Sales one, with the reason mechanics', () => {
  const aidev = getTemplate('recruit.aidev.decline');
  const sales = getTemplate('recruit.sales.decline');
  assert.deepEqual(aidev.mergeFields, sales.mergeFields);
  assert.equal(aidev.when, sales.when);
  assert.match(aidev.description, /The reason paragraph appears only when a manager chose one/);
});

test('the Sales decision emails are exactly as they were', () => {
  assert.equal(getTemplate('recruit.sales.accept').title, 'Shortlisted — Sales & Customer Service (DRAFT — wording on hold)');
  assert.equal(getTemplate('recruit.sales.decline').title, 'Not successful — Sales & Customer Service (DRAFT — wording on hold)');
  for (const key of ['recruit.sales.accept', 'recruit.sales.decline']) {
    assert.doesNotMatch(getTemplate(key).description, /AI Developer/);
  }
});

// ── Routing ─────────────────────────────────────────────────────────────────

function fakeClient() {
  const templates = [];
  return {
    templates,
    query: async (sql, params) => {
      if (/INSERT INTO recruit_outbox/.test(sql)) templates.push(params[0]);
      return { rows: [{ id: 'queued-row' }], rowCount: 1 };
    },
  };
}

test('an AI Developer decision queues the AI Developer email; the others are unchanged', async () => {
  const cases = [
    ['india_aidev', 'accepted', 'recruit.aidev.accept'],
    ['india_aidev', 'declined', 'recruit.aidev.decline'],
    ['india_intern', 'accepted', 'recruit.india.accept'],
    ['india_intern', 'declined', 'recruit.india.decline'],
    ['sa_paralegal', 'accepted', 'recruit.sa.accept'],
    ['sa_paralegal', 'declined', 'recruit.sa.decline'],
    ['sa_sales', 'accepted', 'recruit.sales.accept'],
    ['sa_sales', 'declined', 'recruit.sales.decline'],
  ];
  for (const [role, status, template] of cases) {
    const client = fakeClient();
    const applicant = { id: `app-${role}`, email: 'candidate@example.com', full_name: 'Test Candidate', role };
    await notifyDecision(client, { applicant, status, bookingToken: status === 'accepted' ? 'TOKEN' : null });
    assert.deepEqual(client.templates, [template], `${role} ${status}`);
    assert.ok(getTemplate(template), `${template} is registered`);
  }
});
