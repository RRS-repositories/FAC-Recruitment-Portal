import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Booking-link tokens.
 *
 * The raw token is emailed to the candidate and never stored. What the
 * database holds is its SHA-256, so a database leak hands out no working
 * booking links — build spec §12. That is why lookups are by hash, and why
 * there is no way to recover a token once sent.
 *
 * The token carries no information: it is 32 random bytes. Everything about
 * the candidate is looked up from the row it points at.
 */

const TOKEN_BYTES = 32;

export function generateBookingToken() {
  // base64url so it survives being pasted into a URL, an email client, and a
  // browser address bar without escaping.
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashBookingToken(token) };
}

export function hashBookingToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Compares two hashes without leaking, through timing, how much of one
 * matched. Overkill for a hash lookup that already went through an index, but
 * it costs nothing and removes the question.
 */
export function hashesMatch(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 14 days from now, per §3. */
export function tokenExpiry(days = 14, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 3_600_000);
}
