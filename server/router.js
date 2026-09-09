import express from 'express';
import { adoptPool } from './lib/db.js';
import { createHealthRouter } from './routes/health.js';
import { createRolesRouter } from './routes/roles.js';
import { createPrivacyRouter } from './routes/privacy.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createBookingRouter } from './routes/booking.js';
import { createAdminRouter } from './routes/admin.js';
// Imported for its side effects: registering every email template, so a queued
// row can never find its template missing.
import './templates/index.js';

/**
 * Every recruitment endpoint, behind one mount.
 *
 * Shaped to be mounted inside another Express application:
 *
 *   app.use('/api/recruit', createRecruitRouter({ pool }));
 *
 * which is the same shape as the CRM's own createFosRouter / createCsRouter.
 * The standalone server in `index.js` mounts it the same way, so there is one
 * definition of what this API is rather than two that can drift.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It sets no `trust proxy`, no body parser
 * and no error handler: those belong to whichever application owns the
 * process, and a mounted router quietly changing them would reach outside its
 * own paths. It brings its own rate limiters and its own authentication,
 * because those are about recruitment and nothing else.
 *
 * Health is mounted here too, at `/health`, so a merged deployment can check
 * recruitment is alive without asking the host about itself.
 */
export function createRecruitRouter({ pool, ipSalt = process.env.IP_HASH_SALT } = {}) {
  // Without a salt the stored IP hashes would be reversible with a rainbow
  // table, which defeats the point of hashing them at all.
  if (!ipSalt) {
    throw new Error('[fac-recruit] IP_HASH_SALT is not set. Refusing to mount.');
  }

  // Given a pool, use it. Given none, lib/db.js builds its own from PG* on
  // first use, which is how the standalone server still works.
  if (pool) adoptPool(pool);

  const router = express.Router();

  router.use('/health', createHealthRouter());
  router.use('/roles', createRolesRouter());
  router.use('/privacy', createPrivacyRouter());
  router.use('/applications', createApplicationsRouter({ ipSalt }));
  router.use('/book', createBookingRouter());
  router.use('/admin', createAdminRouter());

  return router;
}

export default createRecruitRouter;
