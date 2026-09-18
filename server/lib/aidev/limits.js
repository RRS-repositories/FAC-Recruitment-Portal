/**
 * The AI Developer role's key and its upload limit.
 *
 * Plain constants, no imports, like ../sales/limits.js: roles.js reaches this
 * through the extended-role registry, and roles.js sits underneath
 * validate.js. Anything heavier here would turn that into an import cycle.
 */

/**
 * The enum value recruit_017 adds. The public slug is `ai-developer`; this is
 * the name stored against every application, and like the others it must
 * never move because somebody preferred a different link.
 */
export const AIDEV_ROLE_KEY = 'india_aidev';

const MB = 1024 * 1024;

export const AIDEV_LIMITS = Object.freeze({
  // The same 10 MB as the sales role, and for the design's own reason: a
  // developer's CV with a portfolio's worth of screenshots, exported from a
  // phone, is regularly over the other roles' 5 MB. There is no voice note.
  cvMaxBytes: 10 * MB,
});
