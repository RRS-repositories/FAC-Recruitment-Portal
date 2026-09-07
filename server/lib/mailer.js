import { mkdir, writeFile } from 'node:fs/promises';
import { createTransport } from 'nodemailer';
import path from 'node:path';

/**
 * Where email actually goes.
 *
 * One switch, read from the environment:
 *
 *   SMTP_HOST set   → sent over SMTP
 *   SMTP_HOST unset → written to disk, one file per email
 *
 * The second mode is not a stub and not a silent no-op. The email is composed,
 * rendered and saved in full, so the whole feature can be built, reviewed and
 * tested before the mailbox exists — and when it does exist, four environment
 * variables switch it over with no code change.
 *
 * What it must never do is quietly discard a message and let the rest of the
 * system believe it was delivered. Every send reports which mode it used, that
 * mode is stored against the row, and the dashboard says so in plain words.
 */

const FILE_DIR = process.env.MAIL_FILE_DIR || './var/mail';

export const mailMode = () => (process.env.SMTP_HOST ? 'smtp' : 'file');

/** Who the mail claims to be from. */
export function sender() {
  const address = process.env.MAIL_FROM || 'recruitment@fastactionclaims.co.uk';
  const name = process.env.MAIL_FROM_NAME || 'Fast Action Claims';
  return { address, name, formatted: `"${name}" <${address}>` };
}

let transport = null;

function smtp() {
  if (transport) return transport;

  transport = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    // Office 365 uses STARTTLS on 587, which is `secure: false` plus an
    // upgrade — not "insecure". Only port 465 wants secure: true.
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    // A hung mail server must not hold a worker slot indefinitely; the row
    // goes back on the queue and is retried with backoff.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transport;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const slug = (value) => String(value).replace(/[^a-z0-9.@_-]/gi, '_').slice(0, 60);

/**
 * Writes the email as a readable file rather than sending it.
 *
 * Deliberately plain text with the headers at the top: the point is that a
 * person can open it and read exactly what a candidate would have received,
 * without a mail client or a parser.
 */
async function toFile(message) {
  const dir = path.resolve(FILE_DIR);
  await mkdir(dir, { recursive: true });

  const file = path.join(dir, `${stamp()}--${slug(message.template ?? 'email')}--${slug(message.to)}.txt`);
  const attachments = (message.attachments ?? [])
    .map((a) => `\n\n--- attachment: ${a.filename} ---\n${a.content}`)
    .join('');

  await writeFile(
    file,
    [
      `From: ${sender().formatted}`,
      `To: ${message.toName ? `"${message.toName}" <${message.to}>` : message.to}`,
      `Subject: ${message.subject}`,
      `Template: ${message.template ?? '—'}`,
      `Written: ${new Date().toISOString()}`,
      '',
      'NOT SENT — no SMTP_HOST is configured, so this was written to disk',
      'instead. Set SMTP_HOST/PORT/USER/PASSWORD to deliver it for real.',
      '',
      '─'.repeat(72),
      '',
      message.text ?? '',
      attachments,
    ].join('\n'),
    'utf8',
  );

  return { mode: 'file', reference: file };
}

/**
 * Sends one email, or writes it. Throws on failure — the caller records the
 * error and lets the queue retry.
 */
export async function sendMail(message) {
  if (mailMode() === 'file') return toFile(message);

  const info = await smtp().sendMail({
    from: sender().formatted,
    to: message.toName ? `"${message.toName}" <${message.to}>` : message.to,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  });

  return { mode: 'smtp', reference: info.messageId };
}

/**
 * Checks the mail server answers, without sending anything.
 *
 * Used at boot and by the health endpoint, so a wrong password is discovered
 * on deploy rather than the first time somebody is accepted.
 */
export async function verifyMail() {
  if (mailMode() === 'file') {
    return { ok: true, mode: 'file', detail: `writing to ${path.resolve(FILE_DIR)}` };
  }
  try {
    await smtp().verify();
    return { ok: true, mode: 'smtp', detail: `${process.env.SMTP_HOST} as ${process.env.SMTP_USER ?? 'anonymous'}` };
  } catch (error) {
    return { ok: false, mode: 'smtp', detail: error.message };
  }
}
