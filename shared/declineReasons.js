/**
 * Why an application was declined.
 *
 * Shared because the two halves must agree on the codes: the dashboard offers
 * them, the server stores and validates them, and a code stored that the
 * dropdown no longer offers is a record nobody can read.
 *
 * `label` is what the manager picks from. `sentence` is what the candidate
 * reads — they are deliberately not the same string. "AI used" is a useful
 * internal shorthand and a poor thing to say to a person; the sentence is the
 * most defensible version of the same fact.
 *
 * NONE is the default and means no reason is recorded and none is sent. That
 * is the honest default: a manager who has not chosen a reason has not given
 * one, and the email should not invent one.
 */

export const NO_REASON = 'none';

export const DECLINE_REASONS = [
  {
    code: NO_REASON,
    label: 'No reason',
    sentence: null, // nothing is added to the email
  },
  {
    code: 'role_fit',
    label: 'Not aligned to the role',
    sentence:
      'On this occasion your experience did not line up closely enough with what this particular role calls for.',
  },
  {
    code: 'experience',
    label: 'Not enough relevant experience',
    sentence:
      'We were looking for more experience in the kind of work this role involves than your application showed.',
  },
  {
    code: 'incomplete',
    label: 'Application incomplete',
    sentence:
      'Parts of your application were left blank or unfinished, so we were not able to assess it fully.',
  },
  {
    code: 'answers_generic',
    label: 'Answers too general',
    sentence:
      'Your written answers stayed general rather than telling us about your own experience, so it was difficult to judge what you would bring to the role.',
  },
  {
    code: 'ai_used',
    label: 'AI-written answers',
    // Worded as what can actually be stood behind. We detect signals — pasted
    // text, typing speed — not authorship, and spec §13.3 warns those signals
    // false-positive on fluent non-native writers, which is most of this pool.
    // Saying "you used ChatGPT" to somebody who did not is an accusation that
    // cannot be taken back; saying the answers did not read as their own work
    // is what the evidence supports.
    sentence:
      'We ask that answers are written in your own words, and on this occasion your written answers did not read as your own work.',
  },
  {
    code: 'other',
    label: 'Other (write your own)',
    sentence: null, // the manager's own words are used instead
  },
];

const BY_CODE = new Map(DECLINE_REASONS.map((r) => [r.code, r]));

/** True for a code the dropdown actually offers. */
export const isDeclineReason = (code) => BY_CODE.has(code);

export const declineReason = (code) => BY_CODE.get(code) ?? null;

/**
 * The sentence to put in the email, or null for none.
 *
 * `other` uses the manager's own words, trimmed and capped. Everything else
 * uses the wording above, so a reason cannot be phrased one way today and
 * another way tomorrow depending on who clicked.
 */
export function declineSentence(code, note) {
  if (!code || code === NO_REASON) return null;
  if (code === 'other') {
    const written = String(note ?? '').trim();
    return written ? written.slice(0, 500) : null;
  }
  return BY_CODE.get(code)?.sentence ?? null;
}
