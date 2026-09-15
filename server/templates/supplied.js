import { readFileSync } from 'node:fs';
import { esc } from './layout.js';

/**
 * Emails supplied as finished HTML, used exactly as supplied.
 *
 * Most templates are written in index.js inside the shared layout. A few
 * arrive as complete, designed documents with an instruction to keep them as
 * they are -- the no-show re-book email is the first. Retyping one into the
 * shared layout would change its design and wording, which is precisely what
 * was asked not to happen. So the file is kept BYTE FOR BYTE in
 * server/templates/supplied/, and this only fills it in.
 *
 * Three things happen to it on the way out, none of which change what the
 * candidate reads:
 *
 *   1. Its HTML comments are removed. They are notes for whoever builds it
 *      ("TEMPLATE: ...", the plain-text copy) and have no business in an email
 *      sitting in somebody's inbox. Outlook's conditional comments (`<!--[if`)
 *      would be kept, since those DO affect rendering; this file has none.
 *   2. `{{merge_field}}` values are filled in, HTML-escaped in the HTML part so
 *      a name containing `<` cannot break or inject into the layout.
 *   3. The plain-text version is taken from the file's own PLAIN-TEXT block, so
 *      the text and HTML parts come from the same approved source.
 *
 * AN UNFILLED FIELD IS AN ERROR, not a blank. An email that reaches a candidate
 * saying "Dear {{first_name}}" is worse than one that does not go at all: the
 * outbox turns a throw into a visible, retryable failure instead.
 */

const SUPPLIED_DIR = new URL('./supplied/', import.meta.url);

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function loadSupplied(filename) {
  const source = readFileSync(new URL(filename, SUPPLIED_DIR), 'utf8');

  const textMatch = /<!--\s*PLAIN-TEXT:\s*([\s\S]*?)-->/i.exec(source);
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(source);

  return {
    source,
    // Comments out, except Outlook's conditional ones.
    html: source.replace(/<!--(?!\[if)[\s\S]*?-->/g, ''),
    text: textMatch ? textMatch[1].trim() : null,
    subject: titleMatch ? titleMatch[1].trim() : null,
  };
}

/**
 * Fills `{{field}}` placeholders. Throws naming every field left unfilled.
 *
 * A value of '' is a deliberate blank and is allowed -- `{{strong_warning}}` is
 * meant to render as nothing. Only a field with NO value supplied at all is an
 * error.
 */
export function fill(template, values, { html = false } = {}) {
  const missing = new Set();
  const out = String(template).replace(PLACEHOLDER, (match, name) => {
    if (!Object.hasOwn(values, name) || values[name] === undefined || values[name] === null) {
      missing.add(name);
      return match;
    }
    return html ? esc(values[name]) : String(values[name]);
  });

  if (missing.size) {
    throw new Error(`supplied template has unfilled fields: ${[...missing].join(', ')}`);
  }
  return out;
}
