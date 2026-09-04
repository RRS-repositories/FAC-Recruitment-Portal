import 'dotenv/config';
import express from 'express';
import { pool, assertConnection } from './lib/db.js';
import { createHealthRouter } from './routes/health.js';

const PORT = Number(process.env.PORT || 5020);

const app = express();

// nginx is the only thing in front of this process, so trust exactly one hop.
// Without it every visitor shares one rate-limit bucket.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', createHealthRouter());

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

const server = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`[fac-recruit] listening on 127.0.0.1:${PORT}`);
  try {
    await assertConnection();
  } catch (error) {
    // Loud but not fatal: the database may still be coming up, and
    // /api/health/db reports the truth either way.
    console.error('[fac-recruit] database not reachable at boot:', error.message);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[fac-recruit] ${signal} — shutting down`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}

export default app;
