import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { pool } from '../lib/db.js';
import { questionsFor, roleBySlug, WRITTEN_QUESTIONS } from '../lib/roles.js';
import {
  hasErrors,
  normaliseDetails,
  validateAnswers,
  validateDetails,
  validateWritten,
} from '../lib/validate.js';
import { storeCv, deleteCv, UploadError, CV_LIMITS } from '../lib/storage.js';
import { scoreApplication } from '../../shared/scoring.js';
import { detectAiUse } from '../../shared/aiDetect.js';
import { aiTuning } from '../lib/aiTuning.js';
import { notifyApplicationReceived } from '../lib/notify.js';
import { isEnabled, requireFlag } from '../lib/flags.js';
import { mailMode } from '../lib/mailer.js';
import { verifyCaptcha } from '../lib/captcha.js';
import { queueReview } from '../lib/llmReview.js';

/**
 * Application intake.
 *
 * Two endpoints: one opens a session when the form is first shown, one accepts
 * the finished application. The session exists so the elapsed time recorded
 * against an application is measured by us, not claimed by the browser.
 */

// Held in memory, then written once we know it is valid and have an applicant
// id to file it under. Multer's own disk mode would litter temp files for
// every rejected submission.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_LIMITS.maxBytes, files: 1 },
});

const INSERT_SESSION = `
  INSERT INTO recruit_sessions (role, ip_hash, user_agent)
  VALUES ($1, $2, $3)
  RETURNING id, started_at
`;

const INSERT_APPLICANT = `
  INSERT INTO recruit_applicants
    (role, full_name, email, phone, written_answers, mcq_answers, rule_score,
     ai_use_level, ai_use_score, ai_use_reasons, telemetry,
     started_at, duration_sec, cv_object_key, cv_filename,
     candidate_tz, source, ip_hash)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
  -- full_name and email come back so the acknowledgement addresses the
  -- candidate with exactly what was stored, rather than a second copy of the
  -- request body that could have been normalised differently.
  RETURNING id, created_at, full_name, email
`;

const hashIp = (ip, salt) => (ip && salt ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null);

export function createApplicationsRouter({ ipSalt }) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: Number(process.env.APPLY_RATE_WINDOW_MS || 60 * 60 * 1000),
    limit: Number(process.env.APPLY_RATE_MAX || 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { ok: false, error: 'Too many attempts from this connection. Please try again later.' },
  });

  // Spec §2. With this off nothing can be submitted, so the pages can go up
  // and be checked before anyone is able to apply.
  router.use(
    requireFlag(
      'recruitment_portal',
      'We are not accepting applications at the moment. Please check back shortly.',
    ),
  );

  /** Opens a session as the form is first shown. */
  router.post('/start', limiter, async (req, res) => {
    const role = roleBySlug(req.body?.role);
    if (!role) return res.status(400).json({ ok: false, error: 'Unknown role.' });

    try {
      const { rows } = await pool.query(INSERT_SESSION, [
        role.apiKey,
        hashIp(req.ip, ipSalt),
        (req.get('user-agent') || '').slice(0, 500) || null,
      ]);
      return res.status(201).json({ ok: true, sessionId: rows[0].id, startedAt: rows[0].started_at });
    } catch (error) {
      console.error('[fac-recruit] session start failed:', error.message);
      // Not fatal to the candidate: the form still works, we just lose the
      // server-side timing for this one. Better than blocking an application.
      return res.status(503).json({ ok: false, error: 'Could not start your application.' });
    }
  });

  router.post('/', limiter, upload.single('cv'), async (req, res) => {
    const role = roleBySlug(req.body?.role);
    if (!role) return res.status(400).json({ ok: false, error: 'Unknown role.' });

    // Checked before anything is parsed, scored or written to disk: the point
    // of a captcha is that the work never starts. Skipped entirely when no
    // secret is configured -- see lib/captcha.js for why that is said out loud
    // rather than left to look like protection.
    const captcha = await verifyCaptcha(req.body?.captchaToken, req.ip);
    if (!captcha.ok) {
      console.warn(`[fac-recruit] application refused by captcha: ${captcha.reason}`);
      return res.status(400).json({
        ok: false,
        // Deliberately the same message whether the token was missing, stale
        // or forged. It is also honest about being recoverable: nothing they
        // typed has been lost, and trying again is the fix.
        error: 'We could not confirm you are a person. Please tick the box again and resubmit.',
        captcha: true,
      });
    }

    const questions = questionsFor(role.apiKey);

    // The form posts JSON blobs as multipart fields, so they arrive as strings.
    let written;
    let answers;
    let telemetry;
    try {
      written = JSON.parse(req.body.written ?? '{}');
      answers = JSON.parse(req.body.answers ?? '{}');
      telemetry = JSON.parse(req.body.telemetry ?? '{}');
    } catch {
      return res.status(400).json({ ok: false, error: 'Could not read that submission.' });
    }

    const details = normaliseDetails(req.body);
    const errors = {
      ...validateDetails(details),
      ...validateWritten(written, WRITTEN_QUESTIONS.map((q) => q.id)),
      ...validateAnswers(answers, questions),
    };
    if (hasErrors(errors)) return res.status(400).json({ ok: false, errors });
    if (!req.file) return res.status(400).json({ ok: false, errors: { cv: 'Please attach your CV.' } });

    // Scored here, from the weights the client never received. §4: never trust
    // a score that arrived over the wire.
    const ruleScore = scoreApplication(questions, answers);
    // §13.3: the tuning comes from recruit_settings rather than from the
    // constants, so a threshold that turns out to be wrong for this candidate
    // pool is an edit and not a deploy. Cached, and it falls back to the
    // built-in numbers when the table cannot be read — an application is
    // never refused over a settings row.
    const ai = detectAiUse(written, telemetry, await aiTuning());

    // Prefer the server's own record of when they started. A client clock can
    // be wrong or edited; if the session is missing we fall back to what was
    // sent, and the difference is visible in the data either way.
    let startedAt = new Date();
    let durationSec = null;
    if (req.body.sessionId) {
      const { rows } = await pool
        .query('SELECT started_at FROM recruit_sessions WHERE id = $1', [req.body.sessionId])
        .catch(() => ({ rows: [] }));
      if (rows[0]) {
        startedAt = rows[0].started_at;
        durationSec = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
      }
    }

    let stored = null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(INSERT_APPLICANT, [
        role.apiKey,
        details.fullName,
        details.email,
        details.phone || null,
        JSON.stringify(written),
        JSON.stringify(answers),
        ruleScore,
        ai.level,
        ai.score,
        JSON.stringify(ai.reasons),
        JSON.stringify(telemetry),
        startedAt,
        durationSec,
        null, // cv key, set below once we have the id to file it under
        req.file.originalname.slice(0, 255),
        role.timezone,
        (req.body.source || 'direct').slice(0, 60),
        hashIp(req.ip, ipSalt),
      ]);

      const applicant = rows[0];

      // Written inside the transaction so a failed insert cannot leave an
      // orphan CV on disk, and a failed write rolls the row back.
      stored = await storeCv({
        applicantId: applicant.id,
        originalName: req.file.originalname,
        buffer: req.file.buffer,
      });

      await client.query('UPDATE recruit_applicants SET cv_object_key = $2 WHERE id = $1', [
        applicant.id,
        stored.key,
      ]);

      await client.query(
        `INSERT INTO recruit_audit (applicant_id, action, payload) VALUES ($1, 'submitted', $2)`,
        [applicant.id, JSON.stringify({ ruleScore, aiLevel: ai.level, durationSec })],
      );

      if (req.body.sessionId) {
        await client.query(
          'UPDATE recruit_sessions SET completed_at = now(), applicant_id = $2 WHERE id = $1',
          [req.body.sessionId, applicant.id],
        );
      }

      // Queued, not sent. Inside the transaction, so the acknowledgement and
      // the application it acknowledges commit together — a candidate can
      // never be told we have their application when we do not.
      await notifyApplicationReceived(client, applicant);

      // Queued in the same transaction, for the same reason: a review that
      // exists for an application that rolled back would be a review of
      // nothing. The worker picks it up on its own schedule, and if the model
      // is off, unreachable or switched off by flag, the row simply waits —
      // no candidate is ever delayed by it.
      await queueReview(client, applicant.id);

      await client.query('COMMIT');

      /*
       * Whether that acknowledgement will actually arrive.
       *
       * The success screen used to promise "we've sent a confirmation to your
       * address" unconditionally. With no mailbox configured and notifications
       * switched off, that was a plain untruth told to every applicant — and
       * the sort that is only discovered by somebody waiting for an email that
       * was never coming.
       */
      const acknowledged = (await isEnabled('recruitment_alerts')) && mailMode() === 'smtp';

      // Nothing about the score or the AI verdict goes back to the candidate.
      return res.status(201).json({ ok: true, id: applicant.id, acknowledged });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (stored) await deleteCv(stored.key);

      if (error instanceof UploadError) {
        return res.status(400).json({ ok: false, errors: { cv: error.message } });
      }
      // 23505 = unique_violation, which here can only be (email, role) — and
      // since recruit_012 that index is partial, so it fires only when there
      // is an application still in play. Somebody previously declined is not
      // blocked and never sees this; the wording says "already with us"
      // rather than "already applied" so it stays true for them too.
      if (error.code === '23505') {
        return res.status(409).json({
          ok: false,
          error:
            'You already have an application with us for this role. We will be in touch about that one.',
        });
      }
      // Log the failure, never the payload — it is someone's personal data.
      console.error('[fac-recruit] application insert failed:', error.message);
      return res.status(503).json({
        ok: false,
        error: 'We could not save your application just now. Please try again shortly.',
      });
    } finally {
      client.release();
    }
  });

  return router;
}

export default createApplicationsRouter;
