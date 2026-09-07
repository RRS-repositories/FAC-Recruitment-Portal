import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authenticate,
  hashPassword,
  issueToken,
  parseAdminUsers,
  requireAdmin,
  verifyToken,
} from './adminAuth.js';

/**
 * This is the only thing between the public internet and a table of
 * candidates' names, emails, phone numbers and CVs. These tests exist to prove
 * it fails closed — a wrong password, a forged token, an expired one, or no
 * configuration at all must all deny.
 */

process.env.ADMIN_TOKEN_SECRET = 'test-secret-not-a-real-one';

const HASH = hashPassword('a-long-enough-password');
const USERS = parseAdminUsers(`brad:brad@example.com:${HASH}`);

test('a correct password authenticates and yields the real email', () => {
  const admin = authenticate('brad', 'a-long-enough-password', USERS);
  assert.equal(admin.email, 'brad@example.com');
});

test('a wrong password is refused', () => {
  assert.equal(authenticate('brad', 'not-the-password', USERS), null);
});

test('an unknown username is refused', () => {
  assert.equal(authenticate('nobody', 'a-long-enough-password', USERS), null);
});

test('a hash only matches the password it was made from', () => {
  const other = parseAdminUsers(`brad:brad@example.com:${hashPassword('a-different-password')}`);
  assert.equal(authenticate('brad', 'a-long-enough-password', other), null);
});

test('two hashes of the same password differ — the salt is doing its job', () => {
  assert.notEqual(hashPassword('same-password-twice'), hashPassword('same-password-twice'));
});

test('malformed ADMIN_USERS entries are dropped, not fatal', () => {
  const users = parseAdminUsers(`good:g@example.com:${HASH},broken-entry,:::`);
  assert.equal(users.size, 1);
  assert.ok(users.has('good'));
});

test('an empty configuration yields no users', () => {
  assert.equal(parseAdminUsers('').size, 0);
  assert.equal(parseAdminUsers(undefined).size, 0);
});

// ── Tokens ──────────────────────────────────────────────────────────────────

test('a freshly issued token verifies', () => {
  const admin = verifyToken(issueToken({ username: 'brad', email: 'brad@example.com' }));
  assert.equal(admin.email, 'brad@example.com');
});

test('a tampered payload is rejected', () => {
  const token = issueToken({ username: 'brad', email: 'brad@example.com' });
  const [, signature] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ u: 'attacker', e: 'attacker@example.com', exp: Date.now() + 60_000 }),
  ).toString('base64url');
  assert.equal(verifyToken(`${forged}.${signature}`), null);
});

test('a token signed with a different secret is rejected', () => {
  const real = process.env.ADMIN_TOKEN_SECRET;
  process.env.ADMIN_TOKEN_SECRET = 'someone-elses-secret';
  const foreign = issueToken({ username: 'brad', email: 'brad@example.com' });
  process.env.ADMIN_TOKEN_SECRET = real;
  assert.equal(verifyToken(foreign), null);
});

test('an expired token is rejected', () => {
  // Issued far enough in the past that its 8-hour life has run out.
  const expired = issueToken({ username: 'brad', email: 'brad@example.com' }, Date.now() - 9 * 3_600_000);
  assert.equal(verifyToken(expired), null);
});

test('malformed tokens are rejected rather than throwing', () => {
  for (const bad of [null, '', 'no-dot', 'a.b.c.d', '....', 'x.y']) {
    assert.equal(verifyToken(bad), null);
  }
});

// ── The middleware ──────────────────────────────────────────────────────────

function runMiddleware(middleware, headers = {}) {
  const req = { get: (name) => headers[name.toLowerCase()] ?? undefined };
  const result = { status: 200, body: null, nexted: false };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  middleware(req, res, () => {
    result.nexted = true;
    result.admin = req.admin;
  });
  return result;
}

test('with no configuration the admin API serves nothing', () => {
  const previous = { users: process.env.ADMIN_USERS, secret: process.env.ADMIN_TOKEN_SECRET };
  delete process.env.ADMIN_USERS;
  delete process.env.ADMIN_TOKEN_SECRET;

  const result = runMiddleware(requireAdmin());
  assert.equal(result.status, 503);
  assert.equal(result.nexted, false);

  process.env.ADMIN_USERS = previous.users;
  process.env.ADMIN_TOKEN_SECRET = previous.secret;
});

test('a valid token passes the middleware', () => {
  process.env.ADMIN_USERS = `brad:brad@example.com:${HASH}`;
  const token = issueToken({ username: 'brad', email: 'brad@example.com' });
  const result = runMiddleware(requireAdmin(), { authorization: `Bearer ${token}` });
  assert.equal(result.nexted, true);
  assert.equal(result.admin.email, 'brad@example.com');
});

test('a missing, malformed or forged Authorization header is refused', () => {
  process.env.ADMIN_USERS = `brad:brad@example.com:${HASH}`;
  const middleware = requireAdmin();

  for (const headers of [
    {},
    { authorization: 'Bearer' },
    { authorization: 'Bearer nonsense' },
    // A password in the header is not a token — Basic auth is exchanged for
    // one at /session and never accepted directly on an API call.
    { authorization: 'Basic YnJhZDpwYXNzd29yZA==' },
  ]) {
    const result = runMiddleware(middleware, headers);
    assert.equal(result.status, 401, `should have refused: ${JSON.stringify(headers)}`);
    assert.equal(result.nexted, false);
  }
});
