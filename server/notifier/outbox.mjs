import nodemailer from 'nodemailer';
import { pool } from '../db.mjs';

/**
 * Notification outbox.
 *
 * The enquiry row *is* the queue. The request handler writes it and returns
 * immediately; this worker picks up rows that have not been notified yet and
 * sends them. That keeps submission latency independent of the mail server, and
 * means an SMTP outage delays a notification instead of failing an enquiry the
 * database already captured.
 *
 * Redis is running on this box, but it belongs to the CRM and carries its
 * queues. Borrowing it would couple the marketing site to CRM infrastructure
 * for no gain at this volume.
 */

const MAX_ATTEMPTS = 6;
const BATCH = 10;

// Rows are claimed with FOR UPDATE SKIP LOCKED so a second instance — or an
// overlapping tick of this one — can never send the same enquiry twice.
const CLAIM = `
  SELECT id, name, company, email, phone, role_type, headcount, message, created_at,
         notify_attempts
    FROM atlas_enquiries
   WHERE notified_at IS NULL
     AND status <> 'spam'
     AND notify_attempts < $1
     AND notify_next_attempt_at <= now()
   ORDER BY notify_next_attempt_at
   LIMIT $2
     FOR UPDATE SKIP LOCKED
`;

const MARK_SENT = `UPDATE atlas_enquiries SET notified_at = now(), notify_error = NULL WHERE id = $1`;

const MARK_FAILED = `
  UPDATE atlas_enquiries
     SET notify_attempts = notify_attempts + 1,
         notify_error = $2,
         notify_next_attempt_at = now() + ($3 || ' seconds')::interval
   WHERE id = $1
`;

/** 1, 2, 4, 8, 16, 32 minutes — capped so a long outage doesn't stall forever. */
const backoffSeconds = (attempts) => Math.min(60 * 2 ** attempts, 30 * 60);

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

function renderEmail(row) {
  const line = (label, value) => (value ? `${label}: ${value}\n` : '');
  return {
    subject: `New Atlas enquiry — ${row.name}${row.company ? ` (${row.company})` : ''}`,
    text:
      `A new enquiry came in through atlasrecruitment.co.uk.\n\n` +
      line('Name', row.name) +
      line('Company', row.company) +
      line('Email', row.email) +
      line('Phone', row.phone) +
      line('Role type', row.role_type) +
      line('How many', row.headcount) +
      `Received: ${row.created_at.toISOString()}\n` +
      (row.message ? `\n---\n${row.message}\n` : '') +
      `\nEnquiry #${row.id}\n`,
  };
}

/**
 * One pass over the outbox.
 *
 * Delivery is at-least-once, not exactly-once: the send is a network call and
 * the stamp is a database write, so a crash between the two would re-send that
 * enquiry on the next pass. A duplicate notification is a far better failure
 * than a lost one, and the alternative — stamping before sending — turns a
 * transient SMTP error into an enquiry nobody ever hears about.
 *
 * The batch is small deliberately: the transaction stays open across the sends,
 * holding row locks, so ten is a sensible ceiling rather than an arbitrary one.
 */
export async function runOnce(transport) {
  const client = await pool.connect();
  let sent = 0;
  let failed = 0;

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(CLAIM, [MAX_ATTEMPTS, BATCH]);

    for (const row of rows) {
      try {
        const { subject, text } = renderEmail(row);
        await transport.sendMail({
          from: process.env.ENQUIRY_NOTIFY_FROM,
          to: process.env.ENQUIRY_NOTIFY_TO,
          replyTo: row.email,
          subject,
          text,
        });
        await client.query(MARK_SENT, [row.id]);
        sent += 1;
      } catch (error) {
        // Record why, but never the enquiry contents — this column is read by
        // whoever debugs the mail server, not by someone entitled to the data.
        const reason = String(error.message || 'unknown').slice(0, 500);
        await client.query(MARK_FAILED, [row.id, reason, backoffSeconds(row.notify_attempts ?? 0)]);
        failed += 1;
        console.error(`[atlas-outbox] enquiry ${row.id} send failed: ${reason}`);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[atlas-outbox] pass failed:', error.message);
  } finally {
    client.release();
  }

  return { sent, failed };
}

/**
 * Starts the poller. Disabled by default: enquiries are captured from the
 * moment the service deploys, and email is switched on separately once the
 * destination inbox is confirmed. Nothing is lost while it is off — unsent rows
 * simply wait in the outbox.
 */
export function startOutbox({ intervalMs = 30_000 } = {}) {
  if (process.env.ENQUIRY_NOTIFY_ENABLED !== 'true') {
    console.log('[atlas-outbox] disabled (ENQUIRY_NOTIFY_ENABLED is not "true") — enquiries still captured');
    return () => {};
  }

  for (const name of ['SMTP_HOST', 'ENQUIRY_NOTIFY_TO', 'ENQUIRY_NOTIFY_FROM']) {
    if (!process.env[name]) {
      throw new Error(`[atlas-outbox] ENQUIRY_NOTIFY_ENABLED=true but ${name} is not set.`);
    }
  }

  const transport = buildTransport();
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap passes
    running = true;
    try {
      const { sent, failed } = await runOnce(transport);
      if (sent || failed) console.log(`[atlas-outbox] sent=${sent} failed=${failed}`);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();

  console.log(`[atlas-outbox] enabled, polling every ${intervalMs / 1000}s`);
  return () => clearInterval(timer);
}

export default startOutbox;
