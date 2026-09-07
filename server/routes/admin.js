import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createReadStream } from 'node:fs';
import { pool } from '../lib/db.js';
import { authenticate, issueToken, parseAdminUsers, requireAdmin } from '../lib/adminAuth.js';
import { resolveCv, cvExists } from '../lib/storage.js';
import { generateBookingToken, tokenExpiry } from '../lib/bookingToken.js';
import { notifyDecision, notifyNoShow } from '../lib/notify.js';
import { cancelPendingFor, historyFor } from '../lib/outbox.js';
import { describeTemplates } from '../lib/templates.js';
import { mailMode } from '../lib/mailer.js';

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

  /**
   * Every email the portal can send, rendered from invented sample data.
   *
   * A manager should be able to read what a candidate will receive BEFORE
   * anybody receives it — a rejection letter is not something to discover the
   * wording of afterwards. Nothing here touches a real record: the samples are
   * fixed, so this page cannot leak an applicant.
   *
   * `mailMode` is on the response because the templates are only half the
   * question. The other half is whether any of it is actually being sent.
   */
  router.get('/templates', (_req, res) =>
    res.json({ ok: true, mode: mailMode(), templates: describeTemplates() }),
  );

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

      // What has actually been sent to this person, so a manager can answer
      // "did they get the link?" without guessing.
      const emails = await historyFor(req.params.id);

      return res.json({ ok: true, application: rows[0], audit, emails, mailMode: mailMode() });
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

      // Queued in the same transaction as the decision. Either both happen or
      // neither does — nobody is accepted without their invitation queued, and
      // no invitation goes out for a decision that rolled back.
      await notifyDecision(client, { applicant: rows[0], status, bookingToken });

      await client.query('COMMIT');
      // The token is still returned, so a manager can send it by hand if they
      // would rather not wait — or if no mailbox is configured yet.
      return res.json({ ok: true, status, bookingToken });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[fac-recruit] decision failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not record that decision.' });
    } finally {
      client.release();
    }
  });

  /**
   * Reissues a booking link.
   *
   * The token is returned exactly once, at the moment of acceptance, and
   * stored only as a hash — so a manager who closes that dialog without
   * copying it, or emails it to a typo, has stranded the candidate with no
   * way back. There has to be a second chance, and this is it.
   *
   * Reissuing invalidates the previous link by replacing the hash. That is
   * the point: if the reason for reissuing is that the first one went to the
   * wrong address, the wrong address must stop working.
   */
  router.post('/applications/:id/booking-link', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: applicant } = await client.query(
        'SELECT id, status, full_name, email, role FROM recruit_applicants WHERE id = $1',
        [req.params.id],
      );
      if (!applicant[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'No such application.' });
      }
      if (applicant[0].status !== 'accepted') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          ok: false,
          error: 'Only an accepted applicant has a booking link. Accept them first.',
        });
      }

      const { rows: existing } = await client.query(
        `SELECT id, status FROM recruit_interviews
          WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.id],
      );
      const latest = existing[0];

      if (latest?.status === 'attended') {
        await client.query('ROLLBACK');
        // They came. A link to book the interview they have already had would
        // only confuse; whatever happens next is a new decision, not a link.
        return res.status(409).json({
          ok: false,
          error: 'That interview has already taken place.',
        });
      }

      // A no-show is the one case where a fresh link IS the point — the spec
      // allows a single rebook, and this is how it is offered.
      const rebookingAfterNoShow = latest?.status === 'no_show';

      const { token, hash } = generateBookingToken();

      // A cancelled interview keeps its row — "they cancelled, and when" is
      // worth being able to answer. So a reissue after a cancellation starts
      // a new one rather than reviving the old.
      if (!latest || latest.status === 'cancelled' || rebookingAfterNoShow) {
        const { rows: interviewer } = await client.query(
          'SELECT id FROM recruit_interviewers WHERE active ORDER BY id LIMIT 1',
        );
        if (!interviewer[0]) throw new Error('no active interviewer configured');

        await client.query(
          `INSERT INTO recruit_interviews (applicant_id, interviewer_id, booking_token_hash, token_expires_at, status)
           VALUES ($1, $2, $3, $4, 'invited')`,
          [req.params.id, interviewer[0].id, hash, tokenExpiry()],
        );
      } else {
        // Invited or already booked: rotate the token and extend the clock,
        // leaving any chosen slot alone. A candidate who has booked keeps
        // their time and gets a working link to manage it.
        await client.query(
          `UPDATE recruit_interviews
              SET booking_token_hash = $2, token_expires_at = $3, updated_at = now()
            WHERE id = $1`,
          [latest.id, hash, tokenExpiry()],
        );
      }

      await client.query(
        `INSERT INTO recruit_audit (applicant_id, actor_email, action, payload)
         VALUES ($1, $2, 'link_reissued', $3)`,
        [
          req.params.id,
          req.admin.email,
          JSON.stringify({ reissuedBy: req.admin.email, rebookingAfterNoShow }),
        ],
      );

      const { rows: freshInterview } = await client.query(
        'SELECT id FROM recruit_interviews WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.params.id],
      );

      // After a no-show the candidate needs the "we missed you" email, not a
      // second copy of the one congratulating them on being shortlisted.
      if (rebookingAfterNoShow) {
        await notifyNoShow(client, {
          applicant: applicant[0],
          interviewId: freshInterview[0]?.id ?? null,
          bookingToken: token,
        });
      } else {
        await notifyDecision(client, {
          applicant: applicant[0],
          status: 'accepted',
          bookingToken: token,
        });
      }

      await client.query('COMMIT');
      console.log(`[fac-recruit] ${req.admin.email} reissued a booking link for ${req.params.id}`);

      return res.json({ ok: true, bookingToken: token, email: applicant[0].email, fullName: applicant[0].full_name });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[fac-recruit] link reissue failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not reissue that link.' });
    } finally {
      client.release();
    }
  });

  /**
   * Records what actually happened at the interview.
   *
   * Without this the no-show figure is decorative — the column exists, the
   * dashboard has a tile for it, and nothing could ever set it. It is also
   * the only signal that distinguishes a candidate who did not turn up from
   * one who is still waiting for their interview.
   */
  router.patch('/applications/:id/interview', async (req, res) => {
    const { status } = req.body ?? {};
    if (status !== 'attended' && status !== 'no_show') {
      return res.status(400).json({ ok: false, error: 'Status must be attended or no_show.' });
    }

    try {
      // The most recent interview that actually HAS a time, not simply the
      // most recent row. Offering a rebook creates a new, unbooked interview,
      // and a mis-clicked no-show still has to be correctable afterwards.
      const { rows } = await pool.query(
        `SELECT id, status, starts_at FROM recruit_interviews
          WHERE applicant_id = $1 AND starts_at IS NOT NULL
          ORDER BY created_at DESC LIMIT 1`,
        [req.params.id],
      );
      const interview = rows[0];

      if (!interview || !interview.starts_at) {
        return res.status(409).json({ ok: false, error: 'That candidate has not booked an interview.' });
      }
      if (interview.status === 'cancelled') {
        return res.status(409).json({ ok: false, error: 'That interview was cancelled.' });
      }
      // Marking an interview that has not started yet is not a record of
      // anything — it is a guess, and one that would quietly become wrong.
      if (new Date(interview.starts_at) > new Date()) {
        return res.status(409).json({ ok: false, error: 'That interview has not happened yet.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE recruit_interviews SET status = $2, updated_at = now() WHERE id = $1',
          [interview.id, status],
        );
        await client.query(
          `INSERT INTO recruit_audit (applicant_id, actor_email, action, payload)
           VALUES ($1, $2, $3, $4)`,
          [req.params.id, req.admin.email, status, JSON.stringify({ markedBy: req.admin.email })],
        );

        // Correcting a mis-clicked no-show must call off the "we missed you"
        // email too, or an apology reaches someone who was there all along.
        if (status === 'attended') {
          await cancelPendingFor(client, interview.id, 'they attended after all');
        }

        await client.query('COMMIT');
      } catch (failure) {
        await client.query('ROLLBACK').catch(() => {});
        throw failure;
      } finally {
        client.release();
      }

      return res.json({ ok: true, status });
    } catch (error) {
      console.error('[fac-recruit] attendance update failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not record that.' });
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
