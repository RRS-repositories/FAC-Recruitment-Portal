import { randomUUID } from 'node:crypto';

/**
 * Sarah's posts to the firm's Mattermost interview channel.
 *
 * ONE CHANNEL, MADE BY HAND. Not one per interview. Nothing here creates a
 * channel, adds a member or archives anything: the channel is created once,
 * the three people who should see it are added in Mattermost, and its id is an
 * environment value. That means membership changes without a deploy, and no
 * list of who sees candidate names lives in a public repository.
 *
 * ITS OWN CLIENT, NOT THE CRM'S. The CRM has a mature Mattermost client in
 * `services/mail/mattermost.js`, and this is deliberately not it: that one is
 * bound to the mail store and writes `mail_errors` rows, and this module has
 * to run standalone against its own database. What IS taken from it is the
 * reasoning, which is worth reading before changing anything here.
 *
 * OFF IS A NORMAL STATE, AND IT IS SAID OUT LOUD. Most environments have no
 * Mattermost credentials. `chatMode()` answers that synchronously with no
 * network, exactly as `mailMode()`, `llmMode()` and `captchaMode()` do, and
 * the Settings page reports it — degrade loudly, never pretend.
 *
 * IT NEVER THROWS. Every path returns `{ ok, reason }`. The outbox turns a
 * rejection into a retry with backoff and a visible unsent row; a throw from
 * here would be an exception in a queue worker instead, which is a worse way
 * to learn the same thing.
 */

const TIMEOUT_MS = Number(process.env.RECRUIT_MATTERMOST_TIMEOUT_MS || 8000);

/*
 * RECRUIT_-prefixed, and that is load-bearing rather than tidy.
 *
 * The CRM sets MATTERMOST_URL and MATTERMOST_BOT_TOKEN for its own mail bot,
 * in the same .env file this module reads. dotenv is last-definition-wins
 * within a file, so an unprefixed name here would not sit alongside the CRM's
 * -- it would silently replace it, and the first symptom would be the CS
 * team's call-back posts going somewhere else. This repo has already had one
 * near-miss of exactly that shape with OLLAMA_API_KEY and OLLAMA_MODEL.
 *
 * The VALUES may be identical. The NAMES must not collide.
 */
const url = () => (process.env.RECRUIT_MATTERMOST_URL || '').replace(/\/+$/, '');
const token = () => process.env.RECRUIT_MATTERMOST_TOKEN || '';
const channelId = () => process.env.RECRUIT_MATTERMOST_CHANNEL || '';

/**
 * Whether posts can actually go out.
 *
 * All three are required. A token with no channel id posts nowhere, and a
 * channel id with no token posts nothing — both are "off", and both should
 * read as off on the Settings page rather than as a working feature that
 * happens to be quiet.
 */
export const chatMode = () => (url() && token() && channelId() ? 'on' : 'off');

/** Which piece is missing, for the message the Settings page shows. */
export function chatMissing() {
  const missing = [];
  if (!url()) missing.push('RECRUIT_MATTERMOST_URL');
  if (!token()) missing.push('RECRUIT_MATTERMOST_TOKEN');
  if (!channelId()) missing.push('RECRUIT_MATTERMOST_CHANNEL');
  return missing;
}

/**
 * Posts one message to the interview channel.
 *
 * `pendingPostId` is the detail that is not obvious and matters most.
 *
 * An eight-second timeout does NOT mean the post failed. Far more often it
 * means the post landed and the reply was slow — and a blind retry then puts a
 * second "Interview in 10 minutes" in the channel. Two pings for one event
 * teach people to read neither, which costs more than the missed post it was
 * trying to avoid.
 *
 * So every attempt of one logical post carries the same `pending_post_id`.
 * Mattermost de-duplicates on that key server-side — the same mechanism its
 * own web app uses for this exact case — so retrying a request that actually
 * landed returns the post that already exists instead of creating a twin.
 * Generating it per attempt would defeat the entire point, which is why the
 * caller owns it and it is generated once, above any retry.
 *
 * Retrying itself is left to the outbox: it already has the backoff curve, the
 * attempt ceiling and the visible failure, and a second retry loop inside a
 * retry loop is how a five-minute outage becomes a hundred requests.
 */
export async function postInterviewMessage({ text, pendingPostId = randomUUID() }) {
  if (chatMode() === 'off') {
    return { ok: false, reason: 'not_configured', mode: 'off' };
  }

  const body = String(text ?? '').trim();
  if (!body) return { ok: false, reason: 'empty_message', mode: 'on' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${url()}/api/v4/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id: channelId(),
        message: body,
        pending_post_id: pendingPostId,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      /*
       * The STATUS, never the body.
       *
       * A Mattermost error body quotes the channel id back at you, and this
       * string is stored in `recruit_outbox.last_error`, which is shown on the
       * dashboard and kept forever. A channel id is not a secret, but it is
       * configuration, and configuration does not belong on a screen.
       */
      return { ok: false, reason: `http_${response.status}`, mode: 'on' };
    }

    const post = await response.json().catch(() => ({}));
    return { ok: true, reason: null, mode: 'on', postId: post?.id ?? null };
  } catch (error) {
    // An abort is a timeout, which as above may well have landed. Named
    // distinctly so a reader of last_error can tell the two apart.
    const reason = error?.name === 'AbortError' ? 'timeout' : `network:${error?.message ?? 'unknown'}`;
    return { ok: false, reason: reason.slice(0, 200), mode: 'on' };
  } finally {
    clearTimeout(timer);
  }
}

export default postInterviewMessage;
