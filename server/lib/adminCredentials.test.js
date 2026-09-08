import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLES,
  findInBootstrap,
  hashPassword,
  issueToken,
  parseAdminUsers,
  verifyPassword,
  verifyToken,
} from './adminCredentials.js';

/**
 * This is the only thing between the public internet and a table of
 * candidates' names, emails, phone numbers and CVs. These tests exist to prove
 * it fails closed — a wrong password, a forged token, an expired one, or no
 * configuration at all must all deny.
 *
 * Nothing here needs a database, which is the point of the module: the parts
 * that decide are separable from the parts that look people up.
 */

process.env.ADMIN_TOKEN_SECRET = 'test-secret-not-a-real-one';

const HASH = hashPassword('a-long-enough-password');

test('a correct password verifies', () => {
  assert.equal(verifyPassword('a-long-enough-password', HASH), true);
});

test('a wrong password is refused', () => {
  assert.equal(verifyPassword('not-the-password', HASH), false);
});

test('a hash only matches the password it was made from', () => {
  assert.equal(verifyPassword('a-long-enough-password', hashPassword('a-different-password')), false);
});

test('two hashes of the same password differ — the salt is doing its job', () => {
  assert.notEqual(hashPassword('same-password-twice'), hashPassword('same-password-twice'));
});

test('a malformed stored hash is refused rather than throwing', () => {
  for (const bad of ['', 'nonsense', 'scrypt$', 'md5$aa$bb', '$$', null, undefined]) {
    assert.equal(verifyPassword('anything', bad), false, `should have refused: ${bad}`);
  }
});

// ── The bootstrap list ──────────────────────────────────────────────────────

test('ADMIN_USERS entries are parsed, and arrive as administrators', () => {
  const users = parseAdminUsers(`brad:brad@example.com:${HASH}`);
  assert.equal(users.get('brad').email, 'brad@example.com');
  // They have to be able to create the accounts that replace them.
  assert.equal(users.get('brad').role, 'administrator');
  assert.equal(users.get('brad').source, 'env');
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

test('a token carries who, and NOT what they may do', () => {
  // Load-bearing. If the role travelled in the token, a demotion or a
  // deactivation would not take effect until it expired — up to a working day
  // of someone still doing a thing you have already stopped them doing.
  const raw = issueToken({ username: 'brad', email: 'brad@example.com', role: 'administrator' });
  const claims = JSON.parse(Buffer.from(raw.split('.')[0], 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(claims).sort(), ['e', 'exp', 'u']);
  assert.equal(verifyToken(raw).role, undefined);
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
  const expired = issueToken(
    { username: 'brad', email: 'brad@example.com' },
    Date.now() - 9 * 3_600_000,
  );
  assert.equal(verifyToken(expired), null);
});

test('malformed tokens are rejected rather than throwing', () => {
  for (const bad of [null, '', 'no-dot', 'a.b.c.d', '....', 'x.y']) {
    assert.equal(verifyToken(bad), null);
  }
});

// ── Roles ───────────────────────────────────────────────────────────────────

test('there are exactly two roles', () => {
  // Each extra role is a question somebody has to answer for every new
  // colleague. Two answers the real one: can they change how the portal runs.
  assert.deepEqual(ROLES, ['reviewer', 'administrator']);
});

// ── Signing in with either ──────────────────────────────────────────────────

test('the bootstrap list can be searched by username or by email', () => {
  const users = parseAdminUsers(`brad:brad@example.com:${HASH}`);
  assert.equal(findInBootstrap(users, 'brad')?.email, 'brad@example.com');
  assert.equal(findInBootstrap(users, 'brad@example.com')?.username, 'brad');
});

test('and neither is case-sensitive', () => {
  const users = parseAdminUsers(`Brad:Brad@Example.com:${HASH}`);
  assert.equal(findInBootstrap(users, 'brad')?.username, 'Brad');
  assert.equal(findInBootstrap(users, 'BRAD@EXAMPLE.COM')?.username, 'Brad');
});

test('a username match beats another person’s email', () => {
  // Usernames cannot contain "@" so this cannot arise from the add form, but
  // the bootstrap list is hand-written and the ordering should not depend on
  // luck: the person whose USERNAME it is wins.
  const users = parseAdminUsers(
    `alice:alice@example.com:${HASH},bob:alice:${HASH}`,
  );
  assert.equal(findInBootstrap(users, 'alice')?.username, 'alice');
});

test('an identifier nobody has finds nobody', () => {
  const users = parseAdminUsers(`brad:brad@example.com:${HASH}`);
  for (const nothing of ['', null, undefined, 'nobody', 'nobody@example.com']) {
    assert.equal(findInBootstrap(users, nothing), null, `should not have found: ${nothing}`);
  }
});
