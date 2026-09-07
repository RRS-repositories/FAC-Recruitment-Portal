import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

/**
 * CV storage on the server's filesystem.
 *
 * WHERE, AND WHY IT MATTERS.
 * On the production box, files live on `/data` — a separate 1.7 TB disk with
 * 728 GB free — not on the root filesystem, which is where the applications
 * themselves run. Two reasons that convention exists and we follow it:
 *
 *   1. A root filesystem that fills up takes the whole box down. Uploads are
 *      the most likely thing to fill a disk, and they are the least important
 *      thing to keep running.
 *   2. `/data` is a different physical disk, so the files survive a root-fs
 *      failure or a bad deploy.
 *
 * WHAT WE DELIBERATELY DO NOT DO: the CRM's client files sit in
 * `/data/s3-root/`, which rclone serves publicly at
 * `files.rowanroseclaims.co.uk`. CVs must never go there — every file in that
 * tree is reachable from the internet, and a CV is a non-client's personal
 * data. We use a sibling directory that nothing serves.
 *
 * Files are addressed by the applicant's UUID, never by their name — a
 * directory listing should not read as a list of who applied.
 */

const ALLOWED = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const MAX_BYTES = 5 * 1024 * 1024;

/** Magic bytes, checked because an extension is a claim, not evidence. */
const SIGNATURES = [
  { ext: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: '.docx', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK.. (zip container)
  { ext: '.doc', bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE compound file
];

export const CV_ROOT = process.env.CV_STORAGE_DIR || path.resolve('var/cvs');

export class UploadError extends Error {}

function extensionOf(filename) {
  const ext = path.extname(filename ?? '').toLowerCase();
  return ext in ALLOWED ? ext : null;
}

function looksLike(buffer, ext) {
  const signature = SIGNATURES.find((s) => s.ext === ext);
  if (!signature) return true;
  return signature.bytes.every((byte, i) => buffer[i] === byte);
}

/**
 * Validates and stores one CV. Returns the key to record on the applicant row.
 *
 * Both checks matter: the extension decides where it can go, and the magic
 * bytes decide whether it is what it claims. A `.pdf` that is really an
 * executable is not stored.
 */
export async function storeCv({ applicantId, originalName, buffer }) {
  if (!buffer?.length) throw new UploadError('No file was uploaded.');
  if (buffer.length > MAX_BYTES) throw new UploadError('That file is larger than 5 MB.');

  const ext = extensionOf(originalName);
  if (!ext) throw new UploadError('Please upload a PDF or Word document.');
  if (!looksLike(buffer, ext)) {
    throw new UploadError(`That file does not look like a valid ${ext.slice(1).toUpperCase()}.`);
  }

  // One directory per applicant, named by UUID. The stored filename is fixed,
  // so a crafted upload name cannot influence the path at all.
  const id = applicantId ?? randomUUID();
  const dir = path.join(CV_ROOT, id);
  await mkdir(dir, { recursive: true });

  const key = path.join(id, `cv${ext}`);
  await writeFile(path.join(CV_ROOT, key), buffer, { mode: 0o640 });

  return {
    key: key.split(path.sep).join('/'),
    bytes: buffer.length,
    contentType: ALLOWED[ext],
    // Lets a later integrity check prove the file has not been swapped.
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** Resolves a stored key to a path, refusing anything that escapes the root. */
export function resolveCv(key) {
  const full = path.resolve(CV_ROOT, key);
  const root = path.resolve(CV_ROOT);
  // `../` in a key would otherwise read any file the process can reach.
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new UploadError('Invalid file reference.');
  }
  return full;
}

export async function cvExists(key) {
  try {
    await stat(resolveCv(key));
    return true;
  } catch {
    return false;
  }
}

/** Used by the retention job, and to clean up a half-finished submission. */
export async function deleteCv(key) {
  try {
    await unlink(resolveCv(key));
    return true;
  } catch {
    return false;
  }
}

export const CV_LIMITS = { maxBytes: MAX_BYTES, allowed: Object.keys(ALLOWED) };
