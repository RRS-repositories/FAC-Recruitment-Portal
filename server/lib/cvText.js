/**
 * A CV as text, for the model to read.
 *
 * The file on disk is a PDF or a Word document; a model needs characters. This
 * is the only place that conversion happens, and it is deliberately allowed to
 * fail: a CV that cannot be read produces a review formed from the written
 * answers alone, marked as such, rather than no review and no explanation.
 *
 * WHY THESE TWO LIBRARIES. Both are already dependencies of the CRM, which is
 * where this module runs in production — `mammoth` 1.11 and `pdfjs-dist` 5.4,
 * installed and in use. Reading a CV therefore adds nothing to the box. They
 * are imported lazily so that a portal running standalone without them, or an
 * import of this file for its pure functions, does not fall over.
 *
 * .doc IS NOT SUPPORTED, deliberately. The legacy binary format needs a
 * different library again, and the honest answer — "we could not read this
 * one" — is better than a fourth dependency carried for a format almost
 * nobody sends any more. The reason is recorded against the applicant.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

/** Long enough to judge a CV by; short enough to keep the prompt sane. */
const MAX_CHARS = Number(process.env.CV_TEXT_MAX_CHARS || 20_000);

export class CvTextError extends Error {}

/** Collapses the whitespace a PDF extractor leaves behind. */
function tidy(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Where pdfjs keeps the metrics for the 14 standard PDF fonts.
 *
 * Without this it warns on every CV set in Helvetica or Times — which is most
 * of them — and can mis-space the extracted text. Resolved from the installed
 * package rather than hardcoded, so it survives the CRM and the portal keeping
 * their node_modules in different places.
 *
 * Forward slashes and a trailing one, always. pdfjs validates this as a URL and
 * refuses a Windows separator — which would have failed only in local
 * development, production being Linux, and that is the worst kind of bug to
 * leave lying about.
 */
function standardFontsDir() {
  const require = createRequire(import.meta.url);
  const entry = require.resolve('pdfjs-dist/package.json');
  return `${path.join(path.dirname(entry), 'standard_fonts').split(path.sep).join('/')}/`;
}

async function fromPdf(buffer) {
  // The legacy build is the one that runs under Node without a DOM.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: standardFontsDir(),
    // A CV is not a web page: nothing here should fetch a font or run a script.
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map((i) => i.str ?? '').join(' '));
    // Stop early rather than walk a 200-page document we will truncate anyway.
    if (pages.join('\n').length > MAX_CHARS) break;
  }
  await doc.destroy();
  return pages.join('\n');
}

async function fromDocx(buffer) {
  const mammoth = await import('mammoth');
  const { value } = await (mammoth.default ?? mammoth).extractRawText({ buffer });
  return value;
}

/**
 * Reads a stored CV.
 *
 * @returns {Promise<{ text: string, chars: number, truncated: boolean }>}
 * @throws {CvTextError} when the format is unsupported or the file unreadable —
 *         caught by the caller, which records it and reviews without the CV.
 */
export async function extractCvText(absolutePath) {
  const ext = path.extname(absolutePath).toLowerCase();

  let buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch (error) {
    throw new CvTextError(`could not read the CV file: ${error.code ?? error.message}`);
  }

  let text;
  try {
    if (ext === '.pdf') text = await fromPdf(buffer);
    else if (ext === '.docx') text = await fromDocx(buffer);
    else if (ext === '.doc') throw new CvTextError('legacy .doc files cannot be read');
    else throw new CvTextError(`unsupported CV format: ${ext || '(none)'}`);
  } catch (error) {
    if (error instanceof CvTextError) throw error;
    throw new CvTextError(`could not extract text: ${error.message}`);
  }

  const tidied = tidy(text);
  if (!tidied) throw new CvTextError('the CV contained no extractable text (it may be a scan)');

  const truncated = tidied.length > MAX_CHARS;
  return {
    text: truncated ? `${tidied.slice(0, MAX_CHARS)}\n\n[truncated]` : tidied,
    chars: tidied.length,
    truncated,
  };
}
