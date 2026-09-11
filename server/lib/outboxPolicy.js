/**
 * The queue's rules, with no plumbing attached.
 *
 * Separate from `outbox.js` because that module opens a database connection
 * the moment it is imported. Everything decidable without a database lives
 * here instead, so it can be tested — and reasoned about — on its own.
 */

/** Six tries over roughly an hour, then a person has to look at it. */
export const MAX_ATTEMPTS = 6;

/** Rows per pass. Small: a stuck batch should not hold the queue for long. */
export const BATCH = 10;

/**
 * 1, 2, 4, 8, 16 minutes, then capped at 30.
 *
 * Doubling rides out a brief blip without hammering a mail server that is
 * struggling. The cap matters as much as the curve: uncapped, the sixth retry
 * would be over an hour out and a morning outage would still be delaying mail
 * in the afternoon.
 */
export const backoffSeconds = (attempts) => Math.min(60 * 2 ** attempts, 30 * 60);

/**
 * Builds the unique key that stops an email being queued twice.
 *
 * Anything that identifies "this exact email, for this exact thing" belongs in
 * the parts. Times are included wherever the email is about a time, so that
 * moving an interview produces a genuinely different key rather than colliding
 * with the reminder for the old slot.
 */
export function dedupeKey(...parts) {
  const key = parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .map((part) => (part instanceof Date ? part.toISOString() : String(part)))
    .join(':');

  if (!key) throw new Error('a dedupe key cannot be empty');
  // The column is capped at 200 characters, and a silently truncated key would
  // be worse than a rejected one: two different emails could collide and the
  // second would never be sent.
  if (key.length > 200) throw new Error(`dedupe key too long (${key.length}): ${key.slice(0, 60)}…`);
  return key;
}

/**
 * Where a queued message can go.
 *
 * Here rather than in outbox.js for the same reason the backoff curve is: it
 * is a fact about the queue that a test should be able to assert without
 * opening a database connection. It must stay in step with the CHECK
 * constraint added by recruit_014.
 */
export const CHANNELS = ['email', 'mattermost'];
