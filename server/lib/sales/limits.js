/**
 * The sales role's key and its upload limits.
 *
 * A module of plain constants with no imports, on purpose: roles.js needs
 * these to describe the role to the form, and roles.js sits underneath
 * validate.js. Anything heavier here would turn that into an import cycle.
 */

/**
 * The enum value recruit_016 adds. The public slug is `sales`; this is the
 * name stored against every application, and like the other two it must never
 * move because somebody preferred a different link.
 */
export const SALES_ROLE_KEY = 'sa_sales';

const MB = 1024 * 1024;

export const SALES_LIMITS = Object.freeze({
  // Twice the other roles' 5 MB. A sales CV is no bigger, but candidates for
  // this role apply from phones far more often, and a phone-exported PDF of a
  // scanned CV is regularly over 5 MB. Refusing it costs us the candidate.
  cvMaxBytes: 10 * MB,
  // A seven-minute note from a phone recorder, uncompressed WAV aside, sits
  // well under this. It is the ceiling multer enforces before a byte is kept.
  voiceMaxBytes: 25 * MB,
  voiceMaxSeconds: 7 * 60,
  voiceMinSeconds: 10,
  // A recording stopped by the 7:00 timer, or a file whose metadata rounds
  // up, can read a second or two long. That is not a candidate cheating the
  // limit, and refusing them over it would be.
  voiceToleranceSeconds: 2,
});
