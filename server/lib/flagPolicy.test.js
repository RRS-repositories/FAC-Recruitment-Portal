import test from 'node:test';
import assert from 'node:assert/strict';

import { FLAGS, flagKey, isOn, readFlags } from './flagPolicy.js';

/**
 * These flags are the only thing standing between a half-finished portal and
 * the public. The rule worth pinning is not what turns them on — it is
 * everything that must NOT.
 */

test('the three flags from spec §2 exist, plus the AI review switch', () => {
  assert.deepEqual(FLAGS, [
    'recruitment_portal',
    'recruitment_booking',
    'recruitment_alerts',
    'recruitment_ai_review',
  ]);
});

test('only the boolean true is on', () => {
  assert.equal(isOn(true), true);
  for (const value of [false, 'true', 'false', 1, 0, 'yes', {}, { enabled: true }, [], null, undefined]) {
    assert.equal(isOn(value), false, `${JSON.stringify(value)} should read as OFF`);
  }
});

test('a missing row is off', () => {
  const flags = readFlags([]);
  assert.deepEqual(flags, {
    recruitment_portal: false,
    recruitment_booking: false,
    recruitment_alerts: false,
    recruitment_ai_review: false,
  });
});

test('a flag reads on only when its own row says true', () => {
  const flags = readFlags([
    { key: 'flags.recruitment_portal', value: true },
    { key: 'flags.recruitment_booking', value: false },
  ]);
  assert.equal(flags.recruitment_portal, true);
  assert.equal(flags.recruitment_booking, false);
  assert.equal(flags.recruitment_alerts, false);
});

test('a misspelled key does not switch anything on', () => {
  // The failure this prevents: a typo in a settings row silently opening the
  // public portal, or silently keeping it shut with no obvious cause.
  const flags = readFlags([
    { key: 'flag.recruitment_portal', value: true },
    { key: 'flags.recruitmentportal', value: true },
    { key: 'recruitment_portal', value: true },
  ]);
  assert.equal(flags.recruitment_portal, false);
});

test('unrelated settings rows are ignored', () => {
  const flags = readFlags([
    { key: 'ai_use.thresholds', value: { ai_used: 60 } },
    { key: 'flags.recruitment_alerts', value: true },
  ]);
  assert.equal(flags.recruitment_alerts, true);
  assert.equal(flags.recruitment_portal, false);
});

test('keys are namespaced so they cannot collide with other settings', () => {
  assert.equal(flagKey('recruitment_portal'), 'flags.recruitment_portal');
});

test('the AI review switch is off unless its own row says true', () => {
  // Turning this on sends candidates' CVs and answers to a third party. It has
  // to be as hard to switch on by accident as the flag that exposes the form.
  assert.equal(readFlags([]).recruitment_ai_review, false);
  for (const value of ['true', 1, {}, null]) {
    assert.equal(
      readFlags([{ key: 'flags.recruitment_ai_review', value }]).recruitment_ai_review,
      false,
      `${JSON.stringify(value)} must not open this door`,
    );
  }
  assert.equal(
    readFlags([{ key: 'flags.recruitment_ai_review', value: true }]).recruitment_ai_review,
    true,
  );
});
