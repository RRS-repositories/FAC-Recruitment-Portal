import 'dotenv/config';
import express from 'express';
import { pool, assertConnection } from './db.mjs';
import { createEnquiriesRouter } from './routes/enquiries.mjs';
import { createAdminRouter } from './routes/admin.mjs';
import { startOutbox } from './notifier/outbox.mjs';

const PORT = Number(process.env.ATLAS_PORT || 5010);

const ipSalt = process.env.ATLAS_IP_HASH_SALT;
if (!ipSalt) {
  throw new Error(
    '[atlas-intake] ATLAS_IP_HASH_SALT is not set. Without it IP hashes would be ' +
      'trivially reversible with a rainbow table. Refusing to start.',
  );
}

const app = express();

// nginx (behind the Cloudflare tunnel) is the only thing that talks to this
// process, so trust exactly one hop. Without this every visitor would share a
// single rate-limit bucket and the hashed IP would be nginx's, not theirs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// A generous enquiry is a few KB; anything larger is not a person typing.
app.use(express.json({ limit: '16kb' }));

// Malformed JSON should read like a client error, not a stack trace.
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ ok: false, error: 'Could not read that request.' });
  }
  return next(error);
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/enquiries', createEnquiriesRouter({ ipSalt }));
app.use('/api/admin', createAdminRouter());

app.use((error, _req, res, _next) => {
  console.error('[atlas-intake] unhandled:', error.message);
  res.status(500).json({ ok: false, error: 'Something went wrong at our end.' });
});

const server = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`[atlas-intake] listening on 127.0.0.1:${PORT}`);
  try {
    await assertConnection();
  } catch (error) {
    // Loud, but not fatal: the database may still be starting. /api/health
    // reports the truth, and a submission returns 503 rather than a lie.
    console.error('[atlas-intake] database not reachable at boot:', error.message);
  }
  startOutbox();
});

// pm2 sends SIGINT on restart; finish in-flight requests before going.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[atlas-intake] ${signal} — shutting down`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
