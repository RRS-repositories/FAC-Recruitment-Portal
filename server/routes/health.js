import { Router } from 'express';
import { pool } from '../lib/db.js';

/**
 * Two separate questions, deliberately.
 *
 * `/health` answers "is the process up?" — used by the client scaffold and by
 * anything that just needs to know the app is listening. `/health/db` answers
 * "can it reach its database?", which is the one that should page someone.
 * Collapsing them into one endpoint makes a database blip look like the whole
 * service being down.
 */
export function createHealthRouter() {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ ok: true, service: 'fac-recruitment-server' });
  });

  router.get('/db', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch (error) {
      console.error('[fac-recruit] health/db failed:', error.message);
      res.status(503).json({ ok: false, error: 'Database unreachable.' });
    }
  });

  return router;
}

export default createHealthRouter;
