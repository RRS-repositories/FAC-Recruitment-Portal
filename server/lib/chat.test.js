import test from 'node:test';
import assert from 'node:assert/strict';

import { CHANNELS } from './outboxPolicy.js';

/**
 * Sarah's posts to the Mattermost interview channel.
 *
 * The module reads its configuration from the environment at call time rather
 * than at import, which is what lets these tests turn it on and off without a
 * module registry trick.
 */

const ENV_KEYS = [
  'RECRUIT_MATTERMOST_URL',
  'RECRUIT_MATTERMOST_TOKEN',
  'RECRUIT_MATTERMOST_CHANNEL',
];

const saved = {};
test.beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
test.afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const configure = () => {
  process.env.RECRUIT_MATTERMOST_URL = 'https://chat.example.invalid';
  process.env.RECRUIT_MATTERMOST_TOKEN = 'test-token';
  process.env.RECRUIT_MATTERMOST_CHANNEL = 'test-channel-id';
};

const load = () => import(`./chat.js?t=${Math.random()}`);

test('all three values are needed before anything is "on"', async () => {
  const { chatMode } = await load();
  for (const k of ENV_KEYS) delete process.env[k];
  assert.equal(chatMode(), 'off');

  // A token with no channel posts nowhere; a channel with no token posts
  // nothing. Both are off, and both must READ as off.
  configure();
  for (const k of ENV_KEYS) {
    const kept = process.env[k];
    delete process.env[k];
    assert.equal(chatMode(), 'off', `${k} missing should read as off`);
    process.env[k] = kept;
  }
  assert.equal(chatMode(), 'on');
});

test('it names what is missing, so Settings can say', async () => {
  const { chatMissing } = await load();
  for (const k of ENV_KEYS) delete process.env[k];
  assert.deepEqual(chatMissing(), ENV_KEYS);

  configure();
  assert.deepEqual(chatMissing(), []);

  delete process.env.RECRUIT_MATTERMOST_CHANNEL;
  assert.deepEqual(chatMissing(), ['RECRUIT_MATTERMOST_CHANNEL']);
});

test('posting while off is refused, and says why rather than throwing', async () => {
  const { postInterviewMessage } = await load();
  for (const k of ENV_KEYS) delete process.env[k];

  const result = await postInterviewMessage({ text: 'anything' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_configured');
  // A throw here would surface as an exception in a queue worker instead of a
  // retryable row, which is a worse way to learn the same thing.
});

test('an empty message is refused before any request is made', async () => {
  const { postInterviewMessage } = await load();
  configure();
  for (const empty of ['', '   ', null, undefined]) {
    const result = await postInterviewMessage({ text: empty });
    assert.equal(result.ok, false, JSON.stringify(empty));
    assert.equal(result.reason, 'empty_message');
  }
});

test('the channel list matches what the migration allows', () => {
  // recruit_014 has a CHECK constraint with exactly these values. If they
  // drift, enqueue accepts a channel the database then rejects.
  assert.deepEqual(CHANNELS, ['email', 'mattermost']);
});

/* ── The one non-obvious guarantee ───────────────────────────────────────── */

test('every attempt of one post carries the same pending_post_id', async () => {
  // This is what stops a retry of a request that actually landed from putting
  // a second "Interview in 10 minutes" in the channel. Mattermost de-duplicates
  // on this key server-side. Generating it per attempt would defeat it.
  const { postInterviewMessage } = await load();
  configure();

  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    seen.push(JSON.parse(options.body).pending_post_id);
    return { ok: true, status: 200, json: async () => ({ id: 'post-1' }) };
  };

  try {
    const id = 'fixed-id-for-this-logical-post';
    await postInterviewMessage({ text: 'one', pendingPostId: id });
    await postInterviewMessage({ text: 'one', pendingPostId: id });
    assert.deepEqual(seen, [id, id]);

    // And a caller that does not supply one still gets a distinct id per post,
    // so two DIFFERENT posts are never collapsed into one.
    seen.length = 0;
    await postInterviewMessage({ text: 'a' });
    await postInterviewMessage({ text: 'b' });
    assert.equal(seen.length, 2);
    assert.notEqual(seen[0], seen[1]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a non-2xx reports the status, never the response body', async () => {
  // A Mattermost error body quotes the channel id back at you, and this string
  // is stored in last_error and shown on the dashboard forever.
  const { postInterviewMessage } = await load();
  configure();

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'channel abc123secret not found' }),
  });

  try {
    const result = await postInterviewMessage({ text: 'x' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'http_403');
    assert.doesNotMatch(JSON.stringify(result), /abc123secret/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a network failure is reported, not thrown', async () => {
  const { postInterviewMessage } = await load();
  configure();

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('getaddrinfo ENOTFOUND');
  };

  try {
    const result = await postInterviewMessage({ text: 'x' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /^network:/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
