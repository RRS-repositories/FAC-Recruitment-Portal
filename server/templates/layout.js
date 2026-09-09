/**
 * The HTML wrapper every email is drawn in.
 *
 * Taken from the four templates the client supplied, and built the way email
 * has to be built rather than the way a page is: nested tables, inline styles,
 * a fixed 600px body, and a background colour behind every gradient. Outlook
 * renders none of `flex`, `grid`, `<style>` blocks or `linear-gradient`, so a
 * header that relied on any of them would arrive as a white strip.
 *
 * Every template still returns `text` as well. That is not a fallback nobody
 * sees — plain text is what lands when a client blocks HTML, and it is what
 * the file-mode writer saves for reading during development.
 */

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

const INK = '#12102b';
const BODY_TEXT = '#374151';
const MUTED = '#6b7280';
const VIOLET = '#6d28d9';
const LINE = '#e5e7eb';

/** The regulatory footer, as it appears on the client's own templates. */
const LEGAL =
  'Sent by Fast Action Claims, a trading name of Rowan Rose Ltd (Company No. 12916452), ' +
  'authorised and regulated by the Solicitors Regulation Authority, SRA No. 8000843.';

/** Where a reply goes. Same resolution order as the mailer's own From. */
const replyAddress = () =>
  process.env.MAIL_REPLY_TO || process.env.MAIL_FROM || 'recruitment@fastactionclaims.co.uk';

/**
 * Escapes a value for HTML.
 *
 * Load-bearing rather than decorative: a candidate types their own name, and
 * "O'Brien & Sons <test>" has to arrive as itself and not as broken markup.
 */
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** A body paragraph. */
export const p = (html) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BODY_TEXT};">${html}</p>`;

/** "Dear Priya," — the name emphasised the way the supplied templates do it. */
export const greeting = (firstName) =>
  p(`Dear <span style="color:${INK};font-weight:600;">${esc(firstName)}</span>,`);

/** The lavender note with the violet edge, for the one thing they must not miss. */
export const callout = (html) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border-left:4px solid ${VIOLET};border-radius:10px;margin:0 0 24px;">` +
  `<tr><td style="padding:14px 18px;font-size:14px;line-height:1.65;color:${INK};">${html}</td></tr></table>`;

/**
 * The call to action, and the same URL again as text underneath.
 *
 * The second copy is not clutter. Plenty of clients strip or rewrite links,
 * and a shortlisted candidate who cannot reach the booking page has no other
 * way in — the token is not something they can be told over the phone.
 */
export function button(href, label) {
  const safe = esc(href);
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;">` +
    `<tr><td align="center" bgcolor="${VIOLET}" style="border-radius:10px;">` +
    `<a href="${safe}" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:${MUTED};">` +
    `If the button doesn't work, copy this into your browser:<br>` +
    `<span style="color:${VIOLET};word-break:break-all;">${safe}</span></p>`
  );
}

/** Label and value, for the interview details an email has to state plainly. */
export const detail = (label, value) =>
  `<p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:${BODY_TEXT};">` +
  `<span style="color:${MUTED};">${esc(label)}</span> ` +
  `<span style="color:${INK};font-weight:600;">${esc(value)}</span></p>`;

const SIGN_OFF_HTML =
  `<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:${BODY_TEXT};">Kind regards,</p>` +
  `<p style="margin:0 0 30px;font-size:15px;line-height:1.7;color:${INK};font-weight:600;">Recruitment Team<br>` +
  `<span style="font-weight:400;color:${MUTED};">Fast Action Claims &middot; Rowan Rose Ltd</span></p>`;

/**
 * Wraps a body in the shell.
 *
 * @param heading  the <h1>, which is also what the eye lands on first
 * @param preview  the preheader: the grey line a client shows beside the
 *                 subject. Left out, clients scrape the first words of the
 *                 body instead, which is usually "Dear Priya".
 * @param body     already-escaped HTML, built from the helpers above
 */
export function shell({ heading, preview, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f5fb;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview ?? '')}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px -12px rgba(46,16,101,0.18);font-family:${FONT};">

        <tr><td style="background:linear-gradient(135deg,#2e1065 0%,#6d28d9 100%);background-color:#2e1065;padding:26px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:38px;height:38px;background:#7c3aed;border-radius:10px;text-align:center;vertical-align:middle;font-size:15px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;">FA</td>
            <td style="padding-left:11px;">
              <div style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Fast Action Claims</div>
              <div style="font-size:11.5px;color:rgba(255,255,255,0.6);">Rowan Rose Ltd</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:34px 32px 8px;">
          <h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;font-weight:800;letter-spacing:-0.02em;color:${INK};">${esc(heading)}</h1>
${body}
${SIGN_OFF_HTML}
        </td></tr>

        <tr><td style="border-top:1px solid ${LINE};padding:20px 32px 26px;">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">${LEGAL}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">Replies to this address reach our recruitment team: <a href="mailto:${esc(replyAddress())}" style="color:${VIOLET};text-decoration:none;">${esc(replyAddress())}</a></p>
        </td></tr>

      </table>
      <p style="margin:16px 0 0;font-size:11.5px;color:${MUTED};font-family:${FONT};">You received this because you applied for a role at Fast Action Claims.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Builds the HTML body from the plain-text one.
 *
 * The point is that there is only ever ONE copy of the words. Writing each
 * email twice is how the two versions quietly stop agreeing -- somebody fixes
 * a sentence in the HTML and the plain-text reader gets last month's. Here the
 * text is the source and the markup is derived from it, so they cannot drift.
 *
 * Blank lines separate paragraphs. A paragraph of the form "Label: <url>", or
 * one starting with the play marker the text uses for its call to action,
 * becomes the button instead.
 */
export function htmlFromText(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const cta = block.replace(/^\u25b6\s*/, "");
      const link = cta.match(/^(.+?):\s*(https?:\/\/\S+)$/);
      if (link) return button(link[2], link[1]);
      return p(esc(block).replaceAll("\n", "<br>"));
    })
    .join("\n");
}

/**
 * One body, rendered both ways.
 *
 * `lines` is the plain-text body WITHOUT the sign-off -- the shell adds its
 * own, and the text half appends the shared one, so neither ends up with two.
 */
export function bodyBoth({ heading, preview, lines, signOff }) {
  const text = lines.join("\n");
  return {
    text: [text, "", signOff].join("\n"),
    html: shell({ heading, preview, body: htmlFromText(text) }),
  };
}

export default shell;
