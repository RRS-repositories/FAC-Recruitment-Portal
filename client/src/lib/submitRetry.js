/**
 * Sending the finished application, again if the connection dropped.
 *
 * A phone on a weak connection can lose a ~1 MB upload part-way, and the
 * browser then reports no response at all (status 0). Trying again a couple of
 * times turns most of those into a submitted application instead of an error.
 *
 * Retried ONLY when both hold:
 *   - there was no response (status 0). Any answer from the server -- a
 *     rejected field, "already applied", "too many attempts", "could not save"
 *     -- is shown exactly as it always was, never retried.
 *   - the form has a session. The server recognises a resend from the same
 *     session and answers it as the first submission, so a retry can never
 *     create a second application or be told "already applied" about the
 *     one it just made.
 *
 * Pure (no React, no fetch of its own), so the rule is tested directly.
 */

/** Pauses before the second and third attempts. Two retries, then give up. */
export const RETRY_DELAYS_MS = [1500, 4000];

/** Shown when every attempt got no response. Specific to submitting. */
export const NOT_SENT_MESSAGE =
  "Your application didn't send. Your connection may have dropped, or your phone can no longer open the CV file. Your answers are still here: choose your CV again, then press Submit application.";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const noResponse = (error) => error?.status === 0;

export async function sendWithRetry(send, { canRetry, delays = RETRY_DELAYS_MS, wait = pause } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      if (!canRetry || !noResponse(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}

export default sendWithRetry;
