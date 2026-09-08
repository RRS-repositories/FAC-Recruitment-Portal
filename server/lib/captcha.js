/**
 * Cloudflare Turnstile, verified server-side (spec §4).
 *
 * One switch, read from the environment, in the same shape as the mailer:
 *
 *   TURNSTILE_SECRET_KEY set   → every application must carry a valid token
 *   TURNSTILE_SECRET_KEY unset → no check, and the API says so out loud
 *
 * The second mode exists because the form has to keep working before somebody
 * has been to the Cloudflare dashboard. What it must never do is pretend: the
 * admin screen reports whether the form is actually protected, so "we have a
 * captcha" cannot quietly mean "there is a widget on the page".
 *
 * The site key is a separate, public value the client renders with. Only the
 * secret decides whether the server enforces anything, so a client built with
 * a site key and a server without a secret is still an unprotected form -- and
 * still says so.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

/** 'on' once a secret exists. Reported by the API and shown in Settings. */
export const captchaMode = () => (process.env.TURNSTILE_SECRET_KEY ? 'on' : 'off');

/**
 * Checks one token with Cloudflare.
 *
 * Fails CLOSED. A captcha that lets everything through when the check cannot
 * be made is not a captcha, and the cost of being wrong here is recoverable:
 * the candidate stays on the page with everything they typed still in it, and
 * is asked to try again. The alternative -- accepting unverified submissions
 * during an outage -- is the thing the control exists to prevent.
 *
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string}>}
 */
export async function verifyCaptcha(token, remoteIp) {
  if (captchaMode() === 'off') return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'missing' };

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: String(token),
  });
  // Cloudflare treats this as advisory; it is sent when we have it and left
  // off when we do not, rather than sending something wrong.
  if (remoteIp) body.set('remoteip', String(remoteIp));

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: `verify-http-${response.status}` };

    const result = await response.json();
    if (result.success) return { ok: true };
    return { ok: false, reason: (result['error-codes'] ?? []).join(',') || 'rejected' };
  } catch (error) {
    // Logged rather than swallowed: if this starts happening, real people are
    // being turned away and somebody has to be able to find out why.
    console.error('[fac-recruit] turnstile verification failed:', error.message);
    return { ok: false, reason: 'unreachable' };
  }
}
