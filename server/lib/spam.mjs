import { createHash } from 'node:crypto';

/**
 * Bot defences that a real person never notices.
 *
 * No CAPTCHA. CAPTCHAs push the cost of the problem onto the visitor — worst
 * onto screen-reader users — and this is a low-volume B2B form where cheaper
 * signals are sufficient. Revisit only if these stop working.
 */

/** Bots fill every field they find, including one no human can reach. */
export function isHoneypotFilled(body) {
  return typeof body?.website === 'string' && body.website.trim() !== '';
}

/**
 * The form stamps its render time. A submission arriving a moment later was not
 * typed by someone who read the labels.
 *
 * A missing or unparseable stamp is treated as human: a real visitor with a
 * clock-skewed device or a blocked script should never be silently discarded.
 */
export function isTooFast(body, minimumMs = 2000) {
  const renderedAt = Number(body?.renderedAt);
  if (!Number.isFinite(renderedAt) || renderedAt <= 0) return false;

  const elapsed = Date.now() - renderedAt;
  // A negative elapsed time means client/server clock skew, not a bot.
  if (elapsed < 0) return false;
  return elapsed < minimumMs;
}

/**
 * Salted SHA-256 of the client IP.
 *
 * Stored instead of the address itself: it still groups repeat submitters for
 * abuse investigation, but it is not the identifier UK GDPR treats an IP as.
 * The salt lives in the environment, so the hashes cannot be reversed with a
 * precomputed table.
 */
export function hashIp(ip, salt) {
  if (!ip || !salt) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/**
 * Express sits behind nginx behind a Cloudflare tunnel, so `req.ip` is only
 * meaningful once `trust proxy` is set — otherwise every visitor shares one
 * bucket and the rate limiter throttles the whole internet at once.
 */
export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}
