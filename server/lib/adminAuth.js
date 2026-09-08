import { pool } from './db.js';
import {
  ROLES,
  decoyHash,
  hashPassword,
  issueToken,
  parseAdminUsers,
  verifyPassword,
  verifyToken,
} from './adminCredentials.js';

/**
 * Who can sign in, and what they may do.
 *
 * The accounts live in `recruit_admins`. Adding a colleague is a row, not a
 * deploy: no server access, no restart, and removing someone takes effect on
 * their next click rather than whenever their token happens to expire.
 *
 * Two rules the rest of the code depends on:
 *
 *   1. The token proves WHO. It carries nothing about what they may do — that
 *      is read from their row on every request, so a change of role or a
 *      deactivation lands immediately instead of up to eight hours later.
 *
 *   2. ADMIN_USERS is the bootstrap and only that. A NEW session can begin
 *      that way only while the accounts table is empty; once anybody has a
 *      real account, signing in with it is refused. A session already open
 *      finishes its eight hours, so adding your first colleague does not sign
 *      you out mid-task. So: applying the migration locks nobody out, and the
 *      door closes on its own without anyone remembering to shut it.
 *
 * WHAT THIS IS NOT: it has no SSO and no MFA. Cloudflare Access in front of
 * /admin would give both and remove password handling entirely — the routes
 * only ever ask `req.admin` who they are talking to, so that swap would be
 * this file and nothing else. A possibility, not a plan; the spec never asked
 * for it.
 *
 * The cryptography lives in `adminCredentials.js`, which needs no database and
 * is where the hardest tests point.
 */

export { ROLES, hashPassword, issueToken, parseAdminUsers, verifyToken };

/** True while nobody has a real account yet. */
export async function usingBootstrap() {
  try {
    const { rows } = await pool.query('SELECT 1 FROM recruit_admins WHERE active LIMIT 1');
    return rows.length === 0;
  } catch (error) {
    // A database we cannot read is not a reason to fall back to the
    // environment and let somebody in. Say so, and refuse.
    console.error('[fac-recruit] could not read the accounts table:', error.message);
    return false;
  }
}

/**
 * One account by username, active or not.
 *
 * The caller decides what an inactive row means, and that distinction matters:
 * "no such account" and "an account that has been switched off" lead to
 * different answers below.
 */
export async function findAdminRow(username) {
  if (!username) return null;

  const { rows } = await pool.query(
    `SELECT id, username, email, full_name, password_hash, role, active
       FROM recruit_admins
      WHERE username = $1`,
    [String(username)],
  );
  return rows[0] ?? null;
}

/** One account that may actually sign in. */
export async function findAdmin(username) {
  const row = await findAdminRow(username);
  return row?.active ? row : null;
}

/** The shape every route sees as `req.admin`. */
const shape = (admin) => ({
  id: admin.id,
  username: admin.username,
  email: admin.email,
  fullName: admin.full_name,
  role: admin.role,
  source: 'database',
});

/**
 * Verifies a username and password against the accounts table, falling back to
 * the bootstrap list only while there are no accounts.
 */
export async function authenticate(username, password) {
  if (await usingBootstrap()) {
    const user = parseAdminUsers().get(username);
    if (!user) {
      decoyHash(password);
      return null;
    }
    return verifyPassword(password ?? '', user.hash)
      ? { username: user.username, email: user.email, role: 'administrator', source: 'env' }
      : null;
  }

  const admin = await findAdmin(username);
  if (!admin) {
    decoyHash(password);
    return null;
  }
  if (!verifyPassword(password ?? '', admin.password_hash)) return null;

  // Best effort — failing to record the visit is not a reason to refuse it.
  pool
    .query('UPDATE recruit_admins SET last_seen_at = now() WHERE id = $1', [admin.id])
    .catch(() => {});

  return shape(admin);
}

/**
 * Express middleware. Fails closed in every direction: no token or a bad one
 * is 401, an account deactivated since signing in is 401, and a database that
 * cannot answer is 503 rather than a guess.
 *
 * The row is read on every request rather than trusted from the token, which
 * is what makes "remove someone now" mean now.
 */
export function requireAdmin() {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const claims = token ? verifyToken(token) : null;

    if (!claims) return res.status(401).json({ ok: false, error: 'Sign in to continue.' });

    try {
      const row = await findAdminRow(claims.username);

      if (row) {
        // Deactivated between signing in and now. Their token is still valid;
        // their account is not, and that is the answer that matters.
        if (!row.active) {
          return res.status(401).json({ ok: false, error: 'Your access has been removed.' });
        }
        req.admin = shape(row);
        return next();
      }

      /*
       * No account of that name, so this is a session that began under the
       * bootstrap. It keeps working for the rest of its eight hours.
       *
       * The first version closed the door the moment one account existed,
       * which meant adding your first colleague signed you out mid-task,
       * before you had added yourself. Correct, and useless.
       *
       * The door still closes — just at sign-in rather than mid-session.
       * `authenticate` refuses the environment list once any account exists,
       * so no NEW session can begin this way; this can only finish one, and it
       * expires within a working day. Emptying ADMIN_USERS ends it sooner,
       * which is what the team screen asks for.
       */
      const envUser = parseAdminUsers().get(claims.username);
      if (envUser) {
        req.admin = {
          username: envUser.username,
          email: envUser.email,
          role: 'administrator',
          source: 'env',
        };
        return next();
      }

      return res.status(401).json({ ok: false, error: 'Your access has been removed.' });
    } catch (error) {
      console.error('[fac-recruit] could not check that sign-in:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not verify your sign-in.' });
    }
  };
}

/**
 * Gates the routes that change how the portal behaves rather than what it
 * holds — availability, feature flags, retention, and the accounts themselves.
 *
 * 403 rather than 404: they are signed in and this exists, they simply may
 * not. Pretending it is missing would send somebody hunting for a bug.
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (req.admin?.role === role) return next();
    return res.status(403).json({
      ok: false,
      error: 'That is only available to an administrator.',
    });
  };
}
