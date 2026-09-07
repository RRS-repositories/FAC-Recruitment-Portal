import { Router } from 'express';
import { publicRolePayload } from '../lib/roles.js';

/**
 * Serves the application form's content.
 *
 * The client no longer bundles the questions — it asks for them. That is what
 * keeps the marking scheme off the candidate's machine, and it is also what
 * lets the wording change without a redeploy once this reads from the database.
 */
export function createRolesRouter() {
  const router = Router();

  router.get('/:slug', (req, res) => {
    const payload = publicRolePayload(req.params.slug);
    if (!payload) {
      return res.status(404).json({ ok: false, error: 'Unknown role.' });
    }

    // Safe to cache briefly: it is identical for every candidate and contains
    // nothing personal. Short, so a copy change appears quickly.
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ ok: true, role: payload });
  });

  return router;
}

export default createRolesRouter;
