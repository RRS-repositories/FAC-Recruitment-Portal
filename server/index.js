import 'dotenv/config';
import express from 'express';
import { pool, assertConnection, ownsPool } from './lib/db.js';
import { createHealthRouter } from './routes/health.js';
import { createRecruitRouter } from './router.js';
import { startOutboxWorker } from './lib/outbox.js';
import { startRetentionSweep } from './lib/retention.js';
import { startLlmReviewWorker } from './lib/llmReview.js';
import { startMeetLinkSweep } from './lib/meetLink.js';
import { verifyMail, mailMode } from './lib/mailer.js';

const PORT = Number(process.env.PORT || 5000);

const app = express();

// nginx is the only thing in front of this process, so trust exactly one hop.
// Without it every visitor shares one rate-limit bucket.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Kept at the top level as well as inside the router: this is the endpoint
// monitoring already watches, and moving it would be a silent break.
app.use('/api/health', createHealthRouter());

// Everything else, from the same definition a host application would mount.
// Standalone we have no pool to hand it, so lib/db.js builds its own.
app.use('/api/recruit', createRecruitRouter());

// Malformed JSON should read as a client error, not a stack trace.
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ ok: false, error: 'Could not read that request.' });
  }
  return next(error);
});

app.use((error, _req, res, _next) => {
  console.error('[fac-recruit] unhandled:', error.message);
  res.status(500).json({ ok: false, error: 'Something went wrong at our end.' });
});

let stopOutbox = () => {};
let stopRetention = () => {};
let stopReviews = () => {};
let stopMeetSweep = () => {};

const server = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`[fac-recruit] listening on 127.0.0.1:${PORT}`);
  try {
    await assertConnection();
  } catch (error) {
    // Loud but not fatal: the database may still be coming up, and
    // /api/health/db reports the truth either way.
    console.error('[fac-recruit] database not reachable at boot:', error.message);
  }

  // Said at boot rather than discovered when somebody is accepted. A wrong
  // password should be visible on deploy, not the first time it matters.
  const mail = await verifyMail();
  if (mailMode() === 'file') {
    console.warn(`[fac-recruit] email is NOT being sent — ${mail.detail}`);
  } else if (mail.ok) {
    console.log(`[fac-recruit] mail server reachable: ${mail.detail}`);
  } else {
    console.error(`[fac-recruit] mail server NOT reachable: ${mail.detail}`);
  }

  stopOutbox = startOutboxWorker();
  // Spec §12. Deletes declined applicants' CVs once they are past the
  // retention period — the one obligation that is breached by doing
  // nothing at all.
  stopRetention = startRetentionSweep();
  stopReviews = startLlmReviewWorker();
  stopMeetSweep = startMeetLinkSweep();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[fac-recruit] ${signal} — shutting down`);
    stopOutbox();
    stopRetention();
    stopReviews();
    stopMeetSweep();
    // Only close a pool we opened. Mounted in another application it is
    // the host's, and closing it would take that application down with us.
    server.close(() => (ownsPool() ? pool.end() : Promise.resolve()).then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}

export default app;
