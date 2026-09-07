import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Admin authentication — the interim.
 *
 * Cloudflare Access is the intended answer and this is deliberately shaped to
 * be replaced by it: the routes only ever ask `req.admin` who they are talking
 * to, so switching means rewriting this file and nothing else.
 *
 * How it works, and why this shape:
 *
 *   · Credentials are per-manager, not a shared login. A single account would
 *     make `decided_by_email` meaningless, and the audit trail is the reason
 *     that column exists.
 *   · Passwords are stored as scrypt hashes in the environment, never
 *     plaintext. scrypt is in Node's standard library, so no dependency.
 *   · Verifying a password mints a short-lived signed token. The browser then
 *     holds that rather than the password, so a leaked value expires by
 *     itself and is scoped to this service.
 *   · Everything compares in constant time, so timing cannot reveal which
 *     half of a guess was right.
 *
 * WHAT THIS IS NOT: it has no SSO, no MFA, and no central revocation —
 * removing someone means editing the environment and restarting. It is safe
 * only over HTTPS, which the Cloudflare tunnel provides. It is a bridge to
 * Access, not a destination.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const TOKEN_TTL_MS = 8 * 3_600_000; // one working day

/** `scrypt$<salt-hex>$<key-hex>` — self-describing, so the format can change. */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  return timingSafeEqual(expected, actual);
}

/**
 * ADMIN_USERS is `username:email:hash` entries separated by commas.
 * A malformed entry is dropped with a warning rather than crashing the
 * process — one bad line should not take the whole admin surface down.
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
    users.set(username, { username, email, hash });
  }
  return users;
}

function secret() {
  const value = process.env.ADMIN_TOKEN_SECRET;
  if (!value) throw new Error('[fac-recruit] ADMIN_TOKEN_SECRET is not set.');
  return value;
}

/** A signed, expiring bearer token. Stateless — nothing to store or clean up. */
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

/** Verifies a username and password. Returns the user, or null. */
export function authenticate(username, password, users = parseAdminUsers()) {
  const user = users.get(username);
  if (!user) {
    // Hash anyway, against a throwaway value, so a missing username takes the
    // same time as a wrong password and cannot be distinguished.
    scryptSync(password ?? '', 'decoy-salt', SCRYPT.keylen, SCRYPT);
    return null;
  }
  return verifyPassword(password ?? '', user.hash) ? { username: user.username, email: user.email } : null;
}

/**
 * Express middleware. Fails closed in every direction: unconfigured returns
 * 503 and serves nothing, a missing or invalid token returns 401.
 */
export function requireAdmin() {
  const users = parseAdminUsers();
  const configured = users.size > 0 && Boolean(process.env.ADMIN_TOKEN_SECRET);

  if (!configured) {
    console.warn('[fac-recruit] admin API disabled — ADMIN_USERS / ADMIN_TOKEN_SECRET not set');
  }

  return (req, res, next) => {
    if (!configured) {
      return res.status(503).json({ ok: false, error: 'Admin access is not configured.' });
    }

    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const admin = token ? verifyToken(token) : null;

    if (!admin) return res.status(401).json({ ok: false, error: 'Sign in to continue.' });

    req.admin = admin;
    return next();
  };
}
