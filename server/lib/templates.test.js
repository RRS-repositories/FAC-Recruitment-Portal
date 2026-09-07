import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __clearTemplates,
  describeTemplates,
  getTemplate,
  registerTemplate,
  renderQueued,
  templateKeys,
} from './templates.js';

/**
 * The registry is the seam that keeps the queue from knowing about any
 * particular email. These tests pin the one behaviour the whole design rests
 * on: what `load` fetches at send time beats what was frozen when the row was
 * queued — which is why a rescheduled interview cannot send yesterday's time.
 */

test.beforeEach(() => __clearTemplates());

const simple = {
  key: 'test.simple',
  title: 'A simple one',
  sample: { name: 'Sample Person' },
  render: (data) => ({ subject: `Hello ${data.name}`, text: `Hi ${data.name}.` }),
};

test('a registered template can be found again', () => {
  registerTemplate(simple);
  assert.equal(getTemplate('test.simple').title, 'A simple one');
  assert.deepEqual(templateKeys(), ['test.simple']);
});

test('a template without a key or a render is refused', () => {
  assert.throws(() => registerTemplate({ render: () => ({}) }), /needs a key/);
  assert.throws(() => registerTemplate({ key: 'x' }), /needs a render/);
});

test('queued vars are rendered when there is nothing to load', async () => {
  registerTemplate(simple);
  const message = await renderQueued({ template: 'test.simple', vars: { name: 'Dev' } }, null);
  assert.equal(message.subject, 'Hello Dev');
  assert.equal(message.text, 'Hi Dev.');
});

test('LIVE data beats the values frozen at queue time', async () => {
  // The whole reason `load` exists. A reminder queued 24 hours ago must show
  // the time the interview is at NOW, not the time it was at then.
  registerTemplate({
    key: 'test.reminder',
    load: async () => ({ time: '15:00' }),
    render: (data) => ({ subject: `Interview at ${data.time}`, text: `See you at ${data.time}.` }),
  });

  const message = await renderQueued(
    { template: 'test.reminder', vars: { time: '09:00 — the old time' } },
    null,
  );
  assert.equal(message.subject, 'Interview at 15:00');
});

test('values that cannot be re-derived still come through', async () => {
  // The booking token is stored only as a hash, so `load` cannot fetch it —
  // it has to survive from queue time.
  registerTemplate({
    key: 'test.accept',
    load: async () => ({ name: 'Dev' }),
    render: (data) => ({ subject: 'Shortlisted', text: `${data.name}: /book/${data.token}` }),
  });

  const message = await renderQueued(
    { template: 'test.accept', vars: { token: 'a-secret-token', name: 'stale' } },
    null,
  );
  assert.match(message.text, /Dev: \/book\/a-secret-token/);
});

test('an unknown template fails loudly rather than sending nothing', async () => {
  await assert.rejects(() => renderQueued({ template: 'test.nope', vars: {} }, null), /no such template/);
});

test('a template that renders without a subject or body is refused', async () => {
  registerTemplate({ key: 'test.empty', render: () => ({ subject: '', text: '' }) });
  await assert.rejects(
    () => renderQueued({ template: 'test.empty', vars: {} }, null),
    /without a subject or body/,
  );
});

// ── The manager's template screen ───────────────────────────────────────────

test('every template can be described and previewed without a database', () => {
  registerTemplate(simple);
  const [described] = describeTemplates();
  assert.equal(described.key, 'test.simple');
  assert.equal(described.preview.subject, 'Hello Sample Person');
  assert.equal(described.error, null);
});

test('a template that throws on its own sample is reported, not thrown', () => {
  // A broken template should be visible to the manager on the templates
  // screen, rather than taking the screen down or surfacing to a candidate.
  registerTemplate({
    key: 'test.broken',
    sample: {},
    render: (data) => ({ subject: data.missing.deep, text: 'x' }),
  });

  const [described] = describeTemplates();
  assert.equal(described.preview, null);
  assert.match(described.error, /Cannot read|undefined/);
});

test('describing templates never reaches for real data', () => {
  // `load` is the only thing that touches the database, and the preview must
  // not call it — otherwise opening the screen would show a real candidate.
  let loaded = false;
  registerTemplate({
    key: 'test.nodb',
    sample: { name: 'Sample' },
    load: async () => {
      loaded = true;
      return {};
    },
    render: (data) => ({ subject: data.name, text: data.name }),
  });

  describeTemplates();
  assert.equal(loaded, false);
});
