/**
 * What a feature flag is, with no database attached.
 *
 * Split out for the same reason as `outboxPolicy`: `flags.js` opens a
 * connection the moment it is imported, and the rule that matters here — what
 * counts as ON — should be testable without one.
 */

/**
 * Spec §2. All default OFF.
 *
 * `recruitment_ai_review` matters more than the others: switching it on starts
 * sending candidates' CVs and written answers to a third-party model. It needs
 * a key in the environment as well, so neither an accidental flag nor a stray
 * key does anything on its own.
 */
export const FLAGS = [
  'recruitment_portal',
  'recruitment_booking',
  'recruitment_alerts',
  'recruitment_ai_review',
];

export const flagKey = (name) => `flags.${name}`;

/**
 * Only the boolean `true` opens a door.
 *
 * Not "truthy" — deliberately. A flag stored as the string "false", or as 1,
 * or as {"enabled":true}, or missing entirely, all mean the same thing: nobody
 * has definitely switched this on. The one direction worth being strict about
 * is the one that exposes the portal to the public.
 */
export const isOn = (value) => value === true;

/** The full picture, with anything unrecognised reading as OFF. */
export function readFlags(rows = []) {
  const values = {};
  for (const name of FLAGS) {
    const row = rows.find((r) => r.key === flagKey(name));
    values[name] = isOn(row?.value);
  }
  return values;
}
