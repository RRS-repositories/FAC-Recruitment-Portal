import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { pool } from '../lib/db.js';
import { questionsFor, roleBySlug, writtenQuestionsFor } from '../lib/roles.js';
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
import { SYSTEM_DNR_ACTOR, reappliedReason } from '../lib/rebookPolicy.js';
import {
  SALES_LIMITS,
  VOICE_MESSAGES,
  checkVoiceFile,
  deleteVoice,
  isSalesRole,
  normaliseProfile,
  profileForStorage,
  scoreSales,
  storeVoice,
  validateProfile,
  validateVoiceMeta,
} from '../lib/sales/index.js';

/**
 * Application intake.
 *
 * Two endpoints: one opens a session when the form is first shown, one accepts
 * the finished application. The session exists so the elapsed time recorded
 * against an application is measured by us, not claimed by the browser.
 *
 * The sales role accepts its finished application at `/sales` instead, because
 * it carries a second file -- the voice note -- and a larger CV. Everything
 * after the upload (resend recognition, captcha, the do-not-rehire bar, AI
 * detection, the audit row, the acknowledgement, the model review) is the one
 * shared path below, so a sales candidate is treated exactly as anyone else.
 */

// Held in memory, then written once we know it is valid and have an applicant
// id to file it under. Multer's own disk mode would litter temp files for
// every rejected submission.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_LIMITS.maxBytes, files: 1 },
});

/*
 * The sales form's upload: a CV and a voice note, each at most once.
 *
 * A separate multer, not a loosened `upload`: the intern and paralegal route
 * keeps its 5 MB, one-file limit exactly. Multer's fileSize is per file and
 * cannot differ by field, so it is set to the larger (voice) ceiling; the
 * CV's own 10 MB is enforced by storeCv, and the voice note's again by
 * checkVoiceFile and storeVoice. Still memory storage, for the same reason.
 */
const salesMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SALES_LIMITS.voiceMaxBytes, files: 2 },
}).fields([
  { name: 'cv', maxCount: 1 },
  { name: 'voice', maxCount: 1 },
]);

const MB = 1024 * 1024;

/**
 * Runs the sales upload and turns its refusals into answers the form can show.
 *
 * A multer error otherwise travels to the host application's error handler
 * and comes back as a 500 "something went wrong" -- which, for a candidate
 * whose recording is simply too big, is both untrue and unhelpful. Each one
 * is reported against the file it concerns, so the form can put it under the
 * right step. Anything that is not a multer refusal still goes to the host.
 */
function salesUpload(req, res, next) {
  salesMulter(req, res, (error) => {
    if (!error) return next();
    if (!(error instanceof multer.MulterError)) return next(error);

    const field = error.field === 'voice' || error.field === 'cv' ? error.field : null;
    let message = null;
    if (error.code === 'LIMIT_FILE_SIZE') {
      message =
        field === 'voice'
          ? VOICE_MESSAGES.tooLarge
          : `That file is larger than ${SALES_LIMITS.cvMaxBytes / MB} MB.`;
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE' && field) {
      // A known field sent twice. The form never does that; one file per box.
      message = field === 'voice' ? 'Please add just one voice note.' : 'Please attach just one CV.';
    }

    if (field && message) return res.status(400).json({ ok: false, errors: { [field]: message } });
    // A file under a name the form never uses, too many parts, an oversized
    // field: nothing a candidate did, so nothing to point them at.
    return res.status(400).json({ ok: false, error: 'Could not read that submission.' });
  });
}

/*
 * The sales role's extra columns (recruit_016), written after INSERT_APPLICANT
 * in the same transaction. A separate statement rather than more columns on
 * the shared insert, so the intern and paralegal insert is byte-for-byte the
 * statement it was -- and cannot start failing because of a column only this
 * role needs.
 */
const UPDATE_SALES = `
  UPDATE recruit_applicants
     SET profile = $2,
         voice_object_key = $3,
         voice_filename = $4,
         voice_mime = $5,
         voice_size_bytes = $6,
         voice_duration_sec = $7,
         voice_source = $8
   WHERE id = $1
`;

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

/*
 * Is this address on the do-not-rehire list? Any earlier application from the
 * same email, for either role.
 *
 * THROUGH to_jsonb, NOT BY COLUMN NAME -- and on this route that matters more
 * than anywhere. Every application anybody submits runs this query. Naming a
 * column that recruit_015 adds would make EVERY submission fail if the code
 * reached production a minute before that migration: the exact shape of the
 * 11 Sep outage, which lost real applications. Through to_jsonb a missing
 * column reads as "not barred", and applications carry on.
 */
const BARRED = `
  SELECT to_jsonb(a) ->> 'do_not_rehire_reason' AS reason
    FROM recruit_applicants a
   WHERE a.email = $1
     AND COALESCE((to_jsonb(a) ->> 'do_not_rehire')::boolean, false)
   ORDER BY a.created_at DESC
   LIMIT 1
`;

/*
 * The application this form session has ALREADY submitted, if any.
 *
 * A phone that loses its connection while sending the application cannot tell
 * "it never arrived" from "it arrived and the reply was lost", so the form
 * sends it again. Without this, the second case would be told "You already
 * have an application with us" about the application it just made.
 *
 * Deliberately narrow: only a session that has completed, and only for the
 * same email and role it completed with. Anything else -- no session, a
 * different address, a new session -- goes through exactly as before.
 */
const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SESSION_SUBMITTED = `
  SELECT a.id, a.email, a.role, a.decided_by_email
    FROM recruit_sessions s
    JOIN recruit_applicants a ON a.id = s.applicant_id
   WHERE s.id = $1 AND s.completed_at IS NOT NULL
`;

async function alreadySubmitted(sessionId, email, roleKey) {
  if (typeof sessionId !== 'string' || !SESSION_UUID.test(sessionId) || !email) return null;
  // A failed lookup is not a reason to refuse an application: it falls
  // through to the normal path, which is what happened before this existed.
  const { rows } = await pool.query(SESSION_SUBMITTED, [sessionId]).catch(() => ({ rows: [] }));
  const found = rows[0];
  if (!found || found.role !== roleKey) return null;
  if (String(found.email).trim().toLowerCase() !== String(email).trim().toLowerCase()) return null;
  return found;
}

/** The reply the first submission would have had. */
const resentReply = async (found) => ({
  ok: true,
  id: found.id,
  // Same rule as a first submission: a do-not-rehire decline was sent nothing.
  acknowledged:
    found.decided_by_email !== SYSTEM_DNR_ACTOR &&
    (await isEnabled('recruitment_alerts')) &&
    mailMode() === 'smtp',
});

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
    // The sales role is refused here as an unknown one: its application
    // includes a voice note this route has nowhere to put, and accepting it
    // without one would store an application the manager cannot assess.
    if (!role || isSalesRole(role)) return res.status(400).json({ ok: false, error: 'Unknown role.' });
    return submitApplication(req, res, role, { cv: req.file });
  });

  /** The sales role's application: the same path, plus a voice note. */
  router.post('/sales', limiter, salesUpload, async (req, res) => {
    const role = roleBySlug(req.body?.role);
    if (!isSalesRole(role)) return res.status(400).json({ ok: false, error: 'Unknown role.' });
    return submitApplication(req, res, role, {
      cv: req.files?.cv?.[0],
      voice: req.files?.voice?.[0],
      sales: true,
    });
  });

  /**
   * Everything after the upload, for every role.
   *
   * One function rather than a copy per route, so a fix to resend handling,
   * the captcha, the do-not-rehire bar or the acknowledgement reaches every
   * candidate at once. Where the sales role differs it says `if (sales)`, and
   * every such branch is skipped entirely for the other two.
   */
  async function submitApplication(req, res, role, { cv, voice = null, sales = false }) {
    // A resend of an application this session already made (the reply to the
    // first was lost): answer as the first would have been answered, and store
    // nothing twice. Before the captcha, because its token is single-use and
    // the first request has already spent it.
    const resent = await alreadySubmitted(req.body?.sessionId, normaliseDetails(req.body).email, role.apiKey);
    if (resent) {
      console.log(`[fac-recruit] application ${resent.id} sent again by the same session; answered as before, nothing stored`);
      return res.status(201).json(await resentReply(resent));
    }

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
    const profile = sales ? normaliseProfile(req.body) : null;
    const errors = {
      ...validateDetails(details),
      ...(sales ? validateProfile(profile) : {}),
      ...validateWritten(written, writtenQuestionsFor(role.apiKey).map((q) => q.id)),
      ...validateAnswers(answers, questions),
    };

    // The sales form reports its two files alongside everything else, so a
    // candidate missing both a CV and a voice note hears about both at once.
    // The voice note's own checks (size, real audio, a believable duration)
    // run here, before anything touches the database.
    let voiceMeta = null;
    if (sales) {
      if (!cv) errors.cv = 'Please attach your CV.';
      const voiceProblem = checkVoiceFile(voice);
      if (voiceProblem) {
        errors.voice = voiceProblem;
      } else {
        voiceMeta = validateVoiceMeta({ duration: req.body.voiceDuration, source: req.body.voiceSource });
        if (voiceMeta.error) errors.voice = voiceMeta.error;
      }
    }

    if (hasErrors(errors)) return res.status(400).json({ ok: false, errors });
    if (!cv) return res.status(400).json({ ok: false, errors: { cv: 'Please attach your CV.' } });

    // Scored here, from the weights the client never received. §4: never trust
    // a score that arrived over the wire.
    // The sales assessment has negative weights and its own rule for them --
    // see lib/sales/scoring.js for why it is not shared/scoring.js.
    const ruleScore = sales ? scoreSales(answers) : scoreApplication(questions, answers);
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
    let storedVoice = null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: barred } = await client.query(BARRED, [details.email]);
      const bar = barred[0] ?? null;

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
        cv.originalname.slice(0, 255),
        role.timezone,
        (req.body.source || 'direct').slice(0, 60),
        hashIp(req.ip, ipSalt),
      ]);

      const applicant = rows[0];

      // Written inside the transaction so a failed insert cannot leave an
      // orphan CV on disk, and a failed write rolls the row back.
      stored = await storeCv({
        applicantId: applicant.id,
        originalName: cv.originalname,
        buffer: cv.buffer,
        ...(sales ? { maxBytes: SALES_LIMITS.cvMaxBytes } : {}),
      });

      await client.query('UPDATE recruit_applicants SET cv_object_key = $2 WHERE id = $1', [
        applicant.id,
        stored.key,
      ]);

      if (sales) {
        // Same reasoning as the CV: written inside the transaction, so a
        // failure anywhere after this rolls the row back and removes the file.
        storedVoice = await storeVoice({
          applicantId: applicant.id,
          originalName: voice.originalname,
          buffer: voice.buffer,
        });
        await client.query(UPDATE_SALES, [
          applicant.id,
          JSON.stringify(profileForStorage(profile)),
          storedVoice.key,
          storedVoice.filename,
          // What the bytes are, not what the browser said they were.
          storedVoice.contentType,
          storedVoice.bytes,
          voiceMeta.durationSec,
          voiceMeta.source,
        ]);
      }

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

      if (bar) {
        /*
         * An address on the do-not-rehire list (decided 15 Sep).
         *
         * The application is kept -- nothing tells the candidate they were
         * blocked -- and declined at once, carrying the bar forward so the
         * dashboard shows why. NO email of any kind is queued: not the
         * acknowledgement, nothing. No AI review either: there is no decision
         * left for it to inform.
         *
         * Everything else about the submission (the CV, the audit row, the
         * session) is exactly as for anyone else, so what the candidate sees
         * does not differ -- see the response below.
         */
        await client.query(
          `UPDATE recruit_applicants
              SET status = 'declined', decided_by_email = $2, decided_at = now(),
                  do_not_rehire = true, do_not_rehire_reason = $3, do_not_rehire_at = now()
            WHERE id = $1`,
          [applicant.id, SYSTEM_DNR_ACTOR, reappliedReason(bar.reason)],
        );
        await client.query(
          `INSERT INTO recruit_audit (applicant_id, action, payload) VALUES ($1, 'auto_declined_dnr', $2)`,
          [applicant.id, JSON.stringify({ reason: reappliedReason(bar.reason) })],
        );
      } else {
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
      }

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
      // False for a barred address, because no acknowledgement is sent: the
      // success screen then says "we have your application" without claiming a
      // confirmation email -- the same words anyone sees whenever email is off,
      // so it neither lies nor reveals the block.
      const acknowledged = !bar && (await isEnabled('recruitment_alerts')) && mailMode() === 'smtp';
      if (bar) console.log(`[fac-recruit] application ${applicant.id} from a do-not-rehire address declined, nothing sent`);

      // Nothing about the score or the AI verdict goes back to the candidate.
      return res.status(201).json({ ok: true, id: applicant.id, acknowledged });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (stored) await deleteCv(stored.key);
      if (storedVoice) await deleteVoice(storedVoice.key);

      if (error instanceof UploadError) {
        // A voice-note refusal carries `field: 'voice'`; a CV's carries none,
        // and is reported under `cv` exactly as it always was.
        return res.status(400).json({ ok: false, errors: { [error.field ?? 'cv']: error.message } });
      }
      // 23505 = unique_violation, which here can only be (email, role) — and
      // since recruit_012 that index is partial, so it fires only when there
      // is an application still in play. Somebody previously declined is not
      // blocked and never sees this; the wording says "already with us"
      // rather than "already applied" so it stays true for them too.
      if (error.code === '23505') {
        // Two copies of the same submission racing (a resend while the first
        // was still being saved): the first won, so this one is answered as a
        // success for that application, not as "already applied".
        const racedWith = await alreadySubmitted(req.body?.sessionId, details.email, role.apiKey);
        if (racedWith) return res.status(201).json(await resentReply(racedWith));
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
  }

  return router;
}

export default createApplicationsRouter;
