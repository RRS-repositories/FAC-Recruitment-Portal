import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The transport is the piece that lets Stage 5 be finished before the mailbox
 * exists. These tests hold it to the one promise that makes that safe: with no
 * SMTP server configured it writes the whole email down and SAYS it did, and
 * it never quietly succeeds at doing nothing.
 *
 * Nothing here opens a socket.
 */

const withEnv = async (env, fn) => {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
  try {
    // Imported fresh each time so the module reads the environment as set.
    const mailer = await import(`./mailer.js?${Math.random()}`);
    return await fn(mailer);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
};

test('with no SMTP host configured, the mode is file', async () => {
  await withEnv({ SMTP_HOST: undefined }, (mailer) => {
    assert.equal(mailer.mailMode(), 'file');
  });
});

test('setting an SMTP host switches the mode, with no code change', async () => {
  await withEnv({ SMTP_HOST: 'smtp.example.com' }, (mailer) => {
    assert.equal(mailer.mailMode(), 'smtp');
  });
});

test('the whole email is written to disk, readable by a person', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fac-mail-'));

  const result = await withEnv({ SMTP_HOST: undefined, MAIL_FILE_DIR: dir }, (mailer) =>
    mailer.sendMail({
      to: 'candidate@example.com',
      toName: 'Sample Candidate',
      template: 'recruit.ack',
      subject: 'Thanks for applying',
      text: 'We have your application and will reply within 48 hours.',
    }),
  );

  assert.equal(result.mode, 'file');

  const files = await readdir(dir);
  assert.equal(files.length, 1);

  const written = await readFile(path.join(dir, files[0]), 'utf8');
  assert.match(written, /To: "Sample Candidate" <candidate@example.com>/);
  assert.match(written, /Subject: Thanks for applying/);
  assert.match(written, /Template: recruit.ack/);
  assert.match(written, /will reply within 48 hours/);
});

test('the written file says plainly that it was NOT sent', async () => {
  // The trap this avoids: a file full of email that reads as though it went
  // out, and someone concluding a candidate was contacted when they were not.
  const dir = await mkdtemp(path.join(tmpdir(), 'fac-mail-'));

  await withEnv({ SMTP_HOST: undefined, MAIL_FILE_DIR: dir }, (mailer) =>
    mailer.sendMail({ to: 'x@example.com', subject: 'Subject', text: 'Body' }),
  );

  const [file] = await readdir(dir);
  const written = await readFile(path.join(dir, file), 'utf8');
  assert.match(written, /NOT SENT/);
  assert.match(written, /SMTP_HOST/);
});

test('attachments are written out too, not silently dropped', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fac-mail-'));

  await withEnv({ SMTP_HOST: undefined, MAIL_FILE_DIR: dir }, (mailer) =>
    mailer.sendMail({
      to: 'x@example.com',
      subject: 'Your interview',
      text: 'Body',
      attachments: [{ filename: 'interview.ics', content: 'BEGIN:VCALENDAR' }],
    }),
  );

  const [file] = await readdir(dir);
  const written = await readFile(path.join(dir, file), 'utf8');
  assert.match(written, /attachment: interview.ics/);
  assert.match(written, /BEGIN:VCALENDAR/);
});

test('the sender is configurable and falls back to the recruitment mailbox', async () => {
  await withEnv({ MAIL_FROM: undefined, MAIL_FROM_NAME: undefined }, (mailer) => {
    assert.match(mailer.sender().formatted, /recruitment@fastactionclaims\.co\.uk/);
  });
  await withEnv({ MAIL_FROM: 'careers@example.com', MAIL_FROM_NAME: 'Careers' }, (mailer) => {
    assert.equal(mailer.sender().formatted, '"Careers" <careers@example.com>');
  });
});

test('verifying in file mode reports where mail is going', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fac-mail-'));
  const result = await withEnv({ SMTP_HOST: undefined, MAIL_FILE_DIR: dir }, (mailer) =>
    mailer.verifyMail(),
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'file');
  assert.match(result.detail, /writing to/);
});

test('a file name identifies the template and the recipient', async () => {
  // So a person can find the email they are looking for without opening ten.
  const dir = await mkdtemp(path.join(tmpdir(), 'fac-mail-'));
  await withEnv({ SMTP_HOST: undefined, MAIL_FILE_DIR: dir }, (mailer) =>
    mailer.sendMail({
      to: 'someone@example.com',
      template: 'recruit.india.accept',
      subject: 'S',
      text: 'B',
    }),
  );
  const [file] = await readdir(dir);
  assert.match(file, /recruit.india.accept/);
  assert.match(file, /someone@example.com/);
});
