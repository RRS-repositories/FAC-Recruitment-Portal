import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * storeCv's optional `maxBytes`, added for the sales role's 10 MB CV.
 *
 * The thing to pin is the default: every existing caller passes nothing, and
 * must get exactly the limit and exactly the words it always had.
 */
const root = await mkdtemp(path.join(os.tmpdir(), 'fac-cv-test-'));
process.env.CV_STORAGE_DIR = root;
test.after(() => rm(root, { recursive: true, force: true }));

const { CV_LIMITS, UploadError, storeCv, deleteCv } = await import('../storage.js');

const MB = 1024 * 1024;
const pdf = (bytes) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes - 9, 0x20)]);

test('the default limit is still 5 MB, with the same message word for word', async () => {
  assert.equal(CV_LIMITS.maxBytes, 5 * MB);
  await assert.rejects(
    storeCv({ applicantId: 'a0000000-0000-4000-8000-000000000001', originalName: 'cv.pdf', buffer: pdf(5 * MB + 1) }),
    (error) => error instanceof UploadError && error.message === 'That file is larger than 5 MB.',
  );
});

test('exactly 5 MB is still accepted by default', async () => {
  const stored = await storeCv({
    applicantId: 'a0000000-0000-4000-8000-000000000002',
    originalName: 'cv.pdf',
    buffer: pdf(5 * MB),
  });
  assert.equal(stored.bytes, 5 * MB);
  assert.equal(await deleteCv(stored.key), true);
});

test('a larger maxBytes lets a larger CV in, and names its own size when refusing', async () => {
  const stored = await storeCv({
    applicantId: 'a0000000-0000-4000-8000-000000000003',
    originalName: 'cv.pdf',
    buffer: pdf(8 * MB),
    maxBytes: 10 * MB,
  });
  assert.equal(stored.key, 'a0000000-0000-4000-8000-000000000003/cv.pdf');
  await deleteCv(stored.key);

  await assert.rejects(
    storeCv({
      applicantId: 'a0000000-0000-4000-8000-000000000004',
      originalName: 'cv.pdf',
      buffer: pdf(10 * MB + 1),
      maxBytes: 10 * MB,
    }),
    { message: 'That file is larger than 10 MB.' },
  );
});

test('the other checks are unchanged whatever maxBytes says', async () => {
  const id = 'a0000000-0000-4000-8000-000000000005';
  await assert.rejects(storeCv({ applicantId: id, originalName: 'cv.txt', buffer: pdf(100), maxBytes: 10 * MB }), {
    message: 'Please upload a PDF or Word document.',
  });
  await assert.rejects(
    storeCv({ applicantId: id, originalName: 'cv.pdf', buffer: Buffer.from('not a pdf'), maxBytes: 10 * MB }),
    { message: 'That file does not look like a valid PDF.' },
  );
});
