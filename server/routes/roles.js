import { Router } from 'express';
import { publicRolePayload } from '../lib/roles.js';
import { requireFlag } from '../lib/flags.js';

/**
 * Serves the application form's content.
 *
 * The client no longer bundles the questions — it asks for them. That is what
 * keeps the marking scheme off the candidate's machine, and it is also what
 * lets the wording change without a redeploy once this reads from the database.
 */
export function createRolesRouter() {
  const router = Router();

  // Spec §2. These questions exist to feed the application form; with the
  // portal closed there is no form, so they close with it.
  router.use(
    requireFlag(
      'recruitment_portal',
      'We are not accepting applications at the moment. Please check back shortly.',
    ),
  );

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
