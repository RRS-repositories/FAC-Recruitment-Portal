import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Passwords and tokens, with no database attached.
 *
 * Split from `adminAuth.js` for the same reason as `outboxPolicy` and
 * `flagPolicy`: that module opens a connection the moment it is imported, and
 * the things worth testing hardest here — that a wrong password fails, that a
 * forged token fails, that an expired one fails — should be provable without
 * one. This is the half that decides; the other half is the half that looks
 * people up.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const TOKEN_TTL_MS = 8 * 3_600_000; // one working day

/** Reviewer reads and decides. Administrator also changes how the portal runs. */
export const ROLES = ['reviewer', 'administrator'];

/** `scrypt$<salt-hex>$<key-hex>` — self-describing, so the format can change. */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  return timingSafeEqual(expected, actual);
}

/**
 * Hashes a throwaway value so an unknown username costs the same as a wrong
 * password. Without it the response time says which half of a guess was right,
 * and an attacker can find real usernames before trying any passwords.
 */
export const decoyHash = (password) => {
  scryptSync(password ?? '', 'decoy-salt', SCRYPT.keylen, SCRYPT);
};

/**
 * ADMIN_USERS is `username:email:hash` entries separated by commas.
 *
 * The bootstrap and only that — see `adminAuth.js` for when it is consulted.
 * A malformed entry is dropped with a warning rather than crashing the
 * process: one bad line should not take the whole admin surface down.
 */
export function parseAdminUsers(raw = process.env.ADMIN_USERS) {
  const users = new Map();
  if (!raw) return users;

  for (const entry of raw.split(',').map((e) => e.trim()).filter(Boolean)) {
    const [username, email, ...hashParts] = entry.split(':');
    const hash = hashParts.join(':');
    if (!username || !email || !hash) {
      console.warn('[fac-recruit] ignoring malformed ADMIN_USERS entry');
      continue;
    }
    // Anyone arriving this way is an administrator: they have to be able to
    // create the accounts that replace them.
    users.set(username, { username, email, hash, role: 'administrator', source: 'env' });
  }
  return users;
}

function secret() {
  const value = process.env.ADMIN_TOKEN_SECRET;
  if (!value) throw new Error('[fac-recruit] ADMIN_TOKEN_SECRET is not set.');
  return value;
}

/**
 * A signed, expiring bearer token.
 *
 * It carries WHO, and deliberately nothing about what they may do. Putting the
 * role in here would mean a demotion or a deactivation did not take effect
 * until the token expired — up to a working day of someone still being able to
 * do a thing you have already stopped them doing.
 */
export function issueToken({ username, email }, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, e: email, exp: now + TOKEN_TTL_MS }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');

  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a mismatch, and a thrown
  // error would itself be a timing signal.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp < Date.now()) return null;
    return { username: claims.u, email: claims.e };
  } catch {
    return null;
  }
}
