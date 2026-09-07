import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createReadStream } from 'node:fs';
import { pool } from '../lib/db.js';
import { authenticate, issueToken, parseAdminUsers, requireAdmin } from '../lib/adminAuth.js';
import { resolveCv, cvExists } from '../lib/storage.js';
import { generateBookingToken, tokenExpiry } from '../lib/bookingToken.js';

/**
 * The manager's view: read applications, accept or decline them.
 *
 * Every response carries personal data, so nothing here is cacheable and
 * nothing is indexable. Decisions are recorded against the person who made
 * them — the whole reason the admin login is per-manager rather than shared.
 */

const PAGE_SIZE = 25;
const STATUSES = new Set(['pending', 'accepted', 'declined']);

const LIST = `
  SELECT a.id, a.created_at, a.role, a.full_name, a.email, a.phone,
         a.rule_score, a.final_score, a.status, a.duration_sec,
         a.ai_use_level, a.ai_use_score, a.ai_use_reasons,
         a.decided_by_email, a.decided_at, a.cv_filename,
         i.status AS interview_status, i.starts_at AS interview_at
    FROM recruit_applicants a
    LEFT JOIN LATERAL (
      SELECT status, starts_at FROM recruit_interviews
       WHERE applicant_id = a.id ORDER BY created_at DESC LIMIT 1
    ) i ON true
   WHERE ($1::recruit_status IS NULL OR a.status = $1)
     AND ($2::recruit_role  IS NULL OR a.role = $2)
     AND ($3::text IS NULL
          OR a.full_name ILIKE '%' || $3 || '%'
          OR a.email::text ILIKE '%' || $3 || '%')
   ORDER BY a.created_at DESC
   LIMIT $4 OFFSET $5
`;

const COUNT = `
  SELECT count(*)::int AS total
    FROM recruit_applicants a
   WHERE ($1::recruit_status IS NULL OR a.status = $1)
     AND ($2::recruit_role  IS NULL OR a.role = $2)
     AND ($3::text IS NULL
          OR a.full_name ILIKE '%' || $3 || '%'
          OR a.email::text ILIKE '%' || $3 || '%')
`;

// The summary counts every application, not just the filtered page: it is the
// state of the pipeline, and a figure that moved when you typed in the search
// box would be worse than no figure at all.
const SUMMARY = `
  SELECT
    count(*)::int                                              AS total,
    count(*) FILTER (WHERE a.status = 'pending')::int          AS pending,
    count(*) FILTER (WHERE a.status = 'accepted')::int         AS accepted,
    count(*) FILTER (WHERE a.status = 'declined')::int         AS declined,
    count(*) FILTER (WHERE a.ai_use_level <> 'clean')::int     AS ai_flagged,
    count(*) FILTER (WHERE i.status = 'booked')::int           AS booked,
    count(*) FILTER (WHERE i.status = 'no_show')::int          AS no_shows
  FROM recruit_applicants a
  LEFT JOIN LATERAL (
    SELECT status FROM recruit_interviews
     WHERE applicant_id = a.id ORDER BY created_at DESC LIMIT 1
  ) i ON true
`;

export function createAdminRouter() {
  const router = Router();

  // Sign-in is rate limited far harder than the read endpoints: it is the one
  // place a password can be guessed at.
  const loginLimiter = rateLimit({
    windowMs: Number(process.env.ADMIN_LOGIN_WINDOW_MS || 15 * 60 * 1000),
    limit: Number(process.env.ADMIN_LOGIN_MAX || 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { ok: false, error: 'Too many sign-in attempts. Please wait and try again.' },
  });

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  /** Exchange a username and password for a short-lived token. */
  router.post('/session', loginLimiter, (req, res) => {
    const users = parseAdminUsers();
    if (users.size === 0 || !process.env.ADMIN_TOKEN_SECRET) {
      return res.status(503).json({ ok: false, error: 'Admin access is not configured.' });
    }

    const admin = authenticate(req.body?.username, req.body?.password, users);
    if (!admin) {
      // One message for both wrong-username and wrong-password: telling them
      // apart is a free hint about which half to keep guessing.
      console.warn(`[fac-recruit] failed admin sign-in for "${req.body?.username ?? ''}"`);
      return res.status(401).json({ ok: false, error: 'Those details were not recognised.' });
    }

    return res.json({ ok: true, token: issueToken(admin), email: admin.email });
  });

  // Everything past here needs a valid token.
  router.use(requireAdmin());

  router.get('/me', (req, res) => res.json({ ok: true, admin: req.admin }));

  router.get('/applications', async (req, res) => {
    const status = STATUSES.has(req.query.status) ? req.query.status : null;
    const role = ['india_intern', 'sa_paralegal'].includes(req.query.role) ? req.query.role : null;
    const search =
      typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim().slice(0, 100) : null;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    try {
      const [list, count, summary] = await Promise.all([
        pool.query(LIST, [status, role, search, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
        pool.query(COUNT, [status, role, search]),
        pool.query(SUMMARY),
      ]);

      return res.json({
        ok: true,
        applications: list.rows,
        page,
        pageSize: PAGE_SIZE,
        total: count.rows[0].total,
        summary: summary.rows[0],
      });
    } catch (error) {
      console.error('[fac-recruit] admin list failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not load applications.' });
    }
  });

  /** The full record, including the written answers. */
  router.get('/applications/:id', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.*, i.status AS interview_status, i.starts_at AS interview_at
           FROM recruit_applicants a
           LEFT JOIN LATERAL (
             SELECT status, starts_at FROM recruit_interviews
              WHERE applicant_id = a.id ORDER BY created_at DESC LIMIT 1
           ) i ON true
          WHERE a.id = $1`,
        [req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ ok: false, error: 'No such application.' });

      const { rows: audit } = await pool.query(
        `SELECT action, actor_email, payload, created_at FROM recruit_audit
          WHERE applicant_id = $1 ORDER BY created_at`,
        [req.params.id],
      );

      return res.json({ ok: true, application: rows[0], audit });
    } catch (error) {
      console.error('[fac-recruit] admin detail failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not load that application.' });
    }
  });

  /**
   * Accept or decline.
   *
   * Accepting mints the booking token here, so the decision and the candidate's
   * booking link are created in one transaction — an accepted applicant can
   * never end up without a way to book.
   */
  router.patch('/applications/:id', async (req, res) => {
    const { status } = req.body ?? {};
    if (status !== 'accepted' && status !== 'declined') {
      return res.status(400).json({ ok: false, error: 'Status must be accepted or declined.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE recruit_applicants
            SET status = $2, decided_by_email = $3, decided_at = now()
          WHERE id = $1 AND status = 'pending'
          RETURNING id, full_name, email, role`,
        [req.params.id, status, req.admin.email],
      );

      if (!rows[0]) {
        await client.query('ROLLBACK');
        // Either it does not exist or someone else already decided it. Both
        // mean "your view is stale", which is what the message should say.
        return res.status(409).json({
          ok: false,
          error: 'That application has already been decided, or no longer exists.',
        });
      }

      let bookingToken = null;
      if (status === 'accepted') {
        const { rows: interviewer } = await client.query(
          'SELECT id FROM recruit_interviewers WHERE active ORDER BY id LIMIT 1',
        );
        if (!interviewer[0]) throw new Error('no active interviewer configured');

        const { token, hash } = generateBookingToken();
        await client.query(
          `INSERT INTO recruit_interviews (applicant_id, interviewer_id, booking_token_hash, token_expires_at, status)
           VALUES ($1, $2, $3, $4, 'invited')`,
          [rows[0].id, interviewer[0].id, hash, tokenExpiry()],
        );
        // Returned once, to be put in the email. Never stored, never
        // retrievable again.
        bookingToken = token;
      }

      await client.query(
        `INSERT INTO recruit_audit (applicant_id, actor_email, action, payload)
         VALUES ($1, $2, $3, $4)`,
        [rows[0].id, req.admin.email, status, JSON.stringify({ decidedBy: req.admin.email })],
      );

      await client.query('COMMIT');
      return res.json({ ok: true, status, bookingToken });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[fac-recruit] decision failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not record that decision.' });
    } finally {
      client.release();
    }
  });

  /** Streams the CV. Not a public URL — it goes through this auth check. */
  router.get('/applications/:id/cv', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT cv_object_key, cv_filename FROM recruit_applicants WHERE id = $1',
        [req.params.id],
      );
      const row = rows[0];
      if (!row?.cv_object_key) return res.status(404).json({ ok: false, error: 'No CV on file.' });
      if (!(await cvExists(row.cv_object_key))) {
        return res.status(404).json({ ok: false, error: 'That file is missing from storage.' });
      }

      console.log(`[fac-recruit] ${req.admin.email} downloaded CV for ${req.params.id}`);

      // `attachment` so a PDF cannot render in-page and run anything.
      res.set('Content-Disposition', `attachment; filename="${(row.cv_filename || 'cv').replace(/"/g, '')}"`);
      res.set('Content-Type', 'application/octet-stream');
      createReadStream(resolveCv(row.cv_object_key)).pipe(res);
      return undefined;
    } catch (error) {
      console.error('[fac-recruit] cv download failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not fetch that file.' });
    }
  });

  return router;
}

export default createAdminRouter;
