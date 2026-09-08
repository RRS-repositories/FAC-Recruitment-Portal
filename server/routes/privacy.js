import { Router } from 'express';
import { retentionMonths } from '../lib/retention.js';

/**
 * The few facts in the privacy notice that can change without a redeploy.
 *
 * Deliberately NOT behind the `recruitment_portal` flag. A privacy notice has
 * to stay readable when applications are closed: people who applied last month
 * still have data here, and telling them "we are not accepting applications"
 * when they ask how their data is handled would be answering a different
 * question.
 *
 * Nothing here is personal or secret -- it is the same for every visitor.
 * Fetching it rather than hardcoding it is the point: an administrator can
 * change how long CVs are kept from the Settings screen, and a notice that
 * kept saying "six months" afterwards would be a false statement about what we
 * actually do.
 */
export function createPrivacyRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    let months = null;
    try {
      months = await retentionMonths();
    } catch (error) {
      // The page has wording for "we could not read this"; it is better than
      // a number that might be wrong.
      console.error('[fac-recruit] retention lookup failed for privacy notice:', error.message);
    }

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      ok: true,
      retentionMonths: months,
      contactEmail:
        process.env.MAIL_REPLY_TO || process.env.MAIL_FROM || 'recruitment@fastactionclaims.co.uk',
    });
  });

  return router;
}

export default createPrivacyRouter;
