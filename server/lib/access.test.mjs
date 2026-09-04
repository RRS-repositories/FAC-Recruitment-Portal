import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';

import { verifyAccessJwt } from './access.mjs';

/**
 * Access control is the only thing standing between the public internet and a
 * table of people's names, work emails and phone numbers. These tests exist to
 * prove it fails closed — a forged, expired, or misaddressed token must be
 * rejected, and "the JWKS endpoint was unreachable" must never mean "allow".
 *
 * A throwaway RSA key stands in for Cloudflare's, and `fetch` is stubbed to
 * serve its public half as a JWKS, so no network or Cloudflare tenant is
 * needed to run this.
 */

const TEAM = 'testteam.cloudflareaccess.com';
const AUD = 'aud-tag-for-this-app';
const KID = 'test-key-1';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const b64url = (input) =>
  Buffer.from(typeof input === 'string' ? input : JSON.stringify(input))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function makeToken(claimOverrides = {}, headerOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: KID, typ: 'JWT', ...headerOverrides };
  const claims = {
    iss: `https://${TEAM}`,
    aud: [AUD],
    exp: now + 600,
    iat: now,
    email: 'brad@example.com',
    sub: randomUUID(),
    ...claimOverrides,
  };

  const signingInput = `${b64url(header)}.${b64url(claims)}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${signature}`;
}

// Serve our public key wherever the module asks for Cloudflare's JWKS.
let jwksShouldFail = false;
globalThis.fetch = async () => {
  if (jwksShouldFail) throw new Error('network down');
  return { ok: true, json: async () => ({ keys: [jwk] }) };
};

const opts = { teamDomain: TEAM, audience: AUD };
const rejects = (token, options = opts) =>
  assert.rejects(() => verifyAccessJwt(token, options));

test('a valid token is accepted and yields the caller', async () => {
  const result = await verifyAccessJwt(makeToken(), opts);
  assert.equal(result.email, 'brad@example.com');
});

test('an expired token is rejected', async () => {
  const past = Math.floor(Date.now() / 1000) - 60;
  await rejects(makeToken({ exp: past }));
});

test('a token for another Access application is rejected', async () => {
  // The aud claim is what stops a token minted for a different app behind the
  // same Access team unlocking this one.
  await rejects(makeToken({ aud: ['some-other-app'] }));
});

test('a token from another issuer is rejected', async () => {
  await rejects(makeToken({ iss: 'https://evil.cloudflareaccess.com' }));
});

test('an unsigned "alg: none" token is rejected', async () => {
  const header = b64url({ alg: 'none', kid: KID, typ: 'JWT' });
  const claims = b64url({ iss: `https://${TEAM}`, aud: [AUD], exp: Math.floor(Date.now() / 1000) + 600 });
  await rejects(`${header}.${claims}.`);
});

test('a tampered payload is rejected', async () => {
  const [header, , signature] = makeToken().split('.');
  const forged = b64url({
    iss: `https://${TEAM}`,
    aud: [AUD],
    exp: Math.floor(Date.now() / 1000) + 600,
    email: 'attacker@example.com',
  });
  await rejects(`${header}.${forged}.${signature}`);
});

test('a token signed by the wrong key is rejected', async () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${b64url({ alg: 'RS256', kid: KID, typ: 'JWT' })}.${b64url({
    iss: `https://${TEAM}`,
    aud: [AUD],
    exp: now + 600,
  })}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(other.privateKey)
    .toString('base64url');
  await rejects(`${signingInput}.${signature}`);
});

test('an unknown signing key id is rejected', async () => {
  await rejects(makeToken({}, { kid: 'not-a-key-we-know' }));
});

test('a missing or malformed token is rejected', async () => {
  await rejects(null);
  await rejects('');
  await rejects('not.a.jwt');
  await rejects('onlyonesegment');
});

test('an unreachable JWKS endpoint denies rather than allows', async () => {
  jwksShouldFail = true;
  try {
    // Fresh audience so the module cannot answer from its cache.
    await rejects(makeToken({ aud: ['uncached'] }), { teamDomain: 'cold.example.com', audience: 'uncached' });
  } finally {
    jwksShouldFail = false;
  }
});
