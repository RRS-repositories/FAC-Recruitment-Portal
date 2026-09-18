import test from 'node:test';
import assert from 'node:assert/strict';

import { describeTemplates, getTemplate, templateKeys } from '../lib/templates.js';
import { TEMPLATE_COUNT } from './index.js';
import { notifyDecision } from '../lib/notify.js';

/**
 * The Sales & Customer Service decision emails: the South Africa template word
 * for word, with the role changed (decided 18 Sep). Pinned line by line
 * against the South Africa emails. Plus the routing: a Sales decision queues a
 * Sales email, and the two original roles still queue exactly theirs.
 */

const SALES = ['recruit.sales.accept', 'recruit.sales.decline'];

test('TEMPLATE_COUNT is every template registered', () => {
  assert.equal(templateKeys().length, TEMPLATE_COUNT);
});

for (const key of SALES) {
  test(`${key} renders its own sample without error`, () => {
    const entry = describeTemplates().find((t) => t.key === key);
    assert.ok(entry, `${key} is registered`);
    assert.equal(entry.error, null);
    assert.ok(entry.preview.subject && entry.preview.text && entry.preview.html);
  });

  test(`${key} never mentions a paralegal role`, () => {
    const tpl = getTemplate(key);
    const out = tpl.render(tpl.sample);
    for (const part of [out.subject, out.text, out.html, tpl.title, tpl.description]) {
      assert.doesNotMatch(part, /paralegal|internship|internshala/i);
    }
    assert.match(out.text, /Sales & Customer Service position/);
  });

  test(`${key} is no longer marked a draft`, () => {
    const tpl = getTemplate(key);
    assert.doesNotMatch(`${tpl.title} ${tpl.description}`, /DRAFT/);
    assert.match(tpl.description, /^Wording and layout supplied by the client, in the South Africa template/);
  });
}

test('each is the South Africa email word for word, only the role line changed', () => {
  const pairs = [
    ['recruit.sa.accept', 'recruit.sales.accept', 'Thank you for applying for the full-time Sales & Customer Service position at Fast Action Claims.'],
    ['recruit.sa.decline', 'recruit.sales.decline', 'Thank you for taking the time to apply for the full-time Sales & Customer Service position at Fast Action Claims.'],
  ];
  for (const [sa, sales, roleLine] of pairs) {
    const data = { ...getTemplate(sa).sample, token: 'T', declineSentence: 'R.', declineReapply: 'A.' };
    const a = getTemplate(sa).render(data);
    const b = getTemplate(sales).render(data);
    assert.equal(b.subject, a.subject, sales);
    const la = a.text.split('\n');
    const lb = b.text.split('\n');
    assert.equal(lb.length, la.length, sales);
    const differing = la.map((line, i) => (line === lb[i] ? null : i)).filter((i) => i !== null);
    assert.deepEqual(differing.map((i) => lb[i]), [roleLine], sales);
  }
});

test('"Application received" says "position" for the new roles only', () => {
  const ack = getTemplate('recruit.ack');
  // As the original roles reach it: roleApplied is the title alone.
  const intern = ack.render({ ...ack.sample, roleTitle: 'Paralegal Internship', roleApplied: 'Paralegal Internship' });
  assert.match(intern.text, /for the Paralegal Internship at Fast Action Claims\./);
  // A context with no roleApplied at all (an email queued before this change) still reads as before.
  const older = ack.render({ ...ack.sample, roleTitle: 'Paralegal — Full-time', roleApplied: undefined });
  assert.match(older.text, /for the Paralegal — Full-time at Fast Action Claims\./);
  const sales = ack.render({ ...ack.sample, roleTitle: 'Sales & Customer Service', roleApplied: 'Sales & Customer Service position' });
  assert.match(sales.text, /for the Sales & Customer Service position at Fast Action Claims\./);
});

test('the sales accept email still carries the booking link', () => {
  const tpl = getTemplate('recruit.sales.accept');
  const out = tpl.render({ ...tpl.sample, token: 'TOKEN-123' });
  assert.match(out.text, /\/book\/TOKEN-123/);
  assert.match(out.html, /\/book\/TOKEN-123/);
});

test('the original four decision emails keep their titles and descriptions', () => {
  const expected = {
    'recruit.india.accept': 'Shortlisted — India',
    'recruit.sa.accept': 'Shortlisted — South Africa',
    'recruit.india.decline': 'Not successful — India',
    'recruit.sa.decline': 'Not successful — South Africa',
  };
  for (const [key, title] of Object.entries(expected)) {
    const tpl = getTemplate(key);
    assert.equal(tpl.title, title);
    assert.match(tpl.description, /^Wording and layout supplied by the client/);
    assert.doesNotMatch(tpl.description, /DRAFT/);
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

test('each role queues its own decision email', async () => {
  const cases = [
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

test('an unknown role still refuses rather than sending nothing', () => {
  const applicant = { id: 'x', email: 'a@example.com', full_name: 'A', role: 'nope' };
  assert.throws(() => notifyDecision(fakeClient(), { applicant, status: 'accepted' }), /no decision email/);
});
