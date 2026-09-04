import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { normalise, validateEnquiry } from '../lib/validate.js';
import { isHoneypotFilled, isTooFast, hashIp, clientIp } from '../lib/spam.js';

const INSERT = `
  INSERT INTO atlas_enquiries
    (name, company, email, phone, role_type, headcount, message, user_agent, ip_hash, status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING id
`;

/** Empty optional fields are stored as NULL, not '', so the CHECKs stay clean. */
const orNull = (value) => (value === '' ? null : value);

export function createEnquiriesRouter({ ipSalt }) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: Number(process.env.ENQUIRY_RATE_WINDOW_MS || 60 * 60 * 1000),
    limit: Number(process.env.ENQUIRY_RATE_MAX || 5),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      ok: false,
      error: 'Too many enquiries from this connection. Please try again shortly, or call us.',
    },
  });

  router.post('/', limiter, async (req, res) => {
    const values = normalise(req.body);

    // Bot checks run before validation: a bot should learn nothing about the
    // rules, and a caught one costs us no database round trip beyond the row.
    const caughtAsSpam = isHoneypotFilled(req.body) || isTooFast(req.body);

    if (!caughtAsSpam) {
      const errors = validateEnquiry(values);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ ok: false, errors });
      }
    }

    try {
      const { rows } = await pool.query(INSERT, [
        values.name || '(not given)',
        orNull(values.company),
        values.email || 'unknown@invalid',
        orNull(values.phone),
        orNull(values.roleType),
        orNull(values.headcount),
        orNull(values.message),
        orNull((req.get('user-agent') || '').slice(0, 500)),
        hashIp(clientIp(req), ipSalt),
        caughtAsSpam ? 'spam' : 'new',
      ]);

      // A caught bot gets the same 201 a real submission gets. Telling it that
      // it was detected only teaches whoever wrote it to try again differently.
      return res.status(201).json({ ok: true, id: caughtAsSpam ? null : rows[0].id });
    } catch (error) {
      // Log the failure, never the payload — it is someone's personal data.
      console.error('[atlas-intake] insert failed:', error.message);
      return res.status(503).json({
        ok: false,
        error: 'We could not save your enquiry just now. Please try again, or email us directly.',
      });
    }
  });

  return router;
}

export default createEnquiriesRouter;
