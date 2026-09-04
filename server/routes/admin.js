import { Router } from 'express';
import { pool } from '../db.js';
import { requireAccess } from '../lib/access.js';

/**
 * Read-and-triage API for captured enquiries.
 *
 * Everything here returns personal data, so every response is marked
 * no-store: an enquiry list has no business sitting in a proxy cache or a
 * browser's back-forward cache after someone signs out.
 */

const PAGE_SIZE = 25;
const STATUSES = new Set(['new', 'contacted', 'closed', 'spam']);

const LIST = `
  SELECT id, created_at, name, company, email, phone, role_type, headcount,
         message, status, notified_at, notify_attempts
    FROM atlas_enquiries
   WHERE ($1::text IS NULL OR status = $1)
     AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%'
          OR company ILIKE '%' || $2 || '%')
   ORDER BY created_at DESC
   LIMIT $3 OFFSET $4
`;

const COUNT = `
  SELECT status, count(*)::int AS n
    FROM atlas_enquiries
   GROUP BY status
`;

const TOTAL = `
  SELECT count(*)::int AS n
    FROM atlas_enquiries
   WHERE ($1::text IS NULL OR status = $1)
     AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%'
          OR company ILIKE '%' || $2 || '%')
`;

export function createAdminRouter() {
  const router = Router();

  router.use(requireAccess());
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  router.get('/enquiries', async (req, res) => {
    const status = STATUSES.has(req.query.status) ? req.query.status : null;
    // Trimmed to empty means "no filter", not "match everything with %%".
    const search = typeof req.query.q === 'string' && req.query.q.trim()
      ? req.query.q.trim().slice(0, 100)
      : null;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    try {
      const [list, total, counts] = await Promise.all([
        pool.query(LIST, [status, search, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
        pool.query(TOTAL, [status, search]),
        pool.query(COUNT),
      ]);

      res.json({
        ok: true,
        enquiries: list.rows,
        page,
        pageSize: PAGE_SIZE,
        total: total.rows[0].n,
        counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
        viewer: req.accessUser?.email ?? null,
      });
    } catch (error) {
      console.error('[atlas-admin] list failed:', error.message);
      res.status(503).json({ ok: false, error: 'Could not load enquiries.' });
    }
  });

  router.patch('/enquiries/:id', async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const { status } = req.body ?? {};

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, error: 'Bad enquiry id.' });
    }
    if (!STATUSES.has(status)) {
      return res.status(400).json({ ok: false, error: 'Unknown status.' });
    }

    try {
      // `status` is the only column this endpoint can write — the app role has
      // no DELETE and no UPDATE grant on anything the enquirer submitted, so a
      // bug here cannot alter or erase the enquiry itself.
      const { rowCount } = await pool.query(
        'UPDATE atlas_enquiries SET status = $2 WHERE id = $1',
        [id, status],
      );
      if (rowCount === 0) return res.status(404).json({ ok: false, error: 'No such enquiry.' });

      console.log(`[atlas-admin] ${req.accessUser?.email} set enquiry ${id} -> ${status}`);
      return res.json({ ok: true });
    } catch (error) {
      console.error('[atlas-admin] update failed:', error.message);
      return res.status(503).json({ ok: false, error: 'Could not update that enquiry.' });
    }
  });

  return router;
}

export default createAdminRouter;
