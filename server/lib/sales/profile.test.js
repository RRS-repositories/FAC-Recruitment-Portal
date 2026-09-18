import test from 'node:test';
import assert from 'node:assert/strict';

import { SALES_DETAIL_OPTIONS } from './questions.js';
import { normaliseProfile, profileForStorage, validateProfile } from './profile.js';

/**
 * The sales details step. The rule worth pinning: every dropdown accepts only
 * its own list, everything is required except "where did you hear about us",
 * and nothing the form did not ask for survives normalisation.
 */

const VALID = {
  city: 'Cape Town',
  qualification: 'Matric / NSC',
  experience: '1–2 years',
  heardFrom: 'LinkedIn',
  noticePeriod: '1 month',
};

test('a complete profile has no errors', () => {
  assert.deepEqual(validateProfile(normaliseProfile(VALID)), {});
});

test('every option in every list is accepted', () => {
  const lists = {
    qualification: SALES_DETAIL_OPTIONS.qualifications,
    experience: SALES_DETAIL_OPTIONS.experience,
    heardFrom: SALES_DETAIL_OPTIONS.heardFrom,
    noticePeriod: SALES_DETAIL_OPTIONS.noticePeriods,
  };
  for (const [field, options] of Object.entries(lists)) {
    for (const value of options) {
      assert.deepEqual(validateProfile(normaliseProfile({ ...VALID, [field]: value })), {}, `${field}: ${value}`);
    }
  }
});

test('the lists match the design, without its blank placeholder', () => {
  assert.equal(SALES_DETAIL_OPTIONS.qualifications.length, 6);
  assert.equal(SALES_DETAIL_OPTIONS.experience.length, 5);
  assert.equal(SALES_DETAIL_OPTIONS.heardFrom.length, 6);
  assert.equal(SALES_DETAIL_OPTIONS.noticePeriods.length, 5);
  for (const list of Object.values(SALES_DETAIL_OPTIONS)) assert.ok(!list.includes(''));
});

test('city, qualification, experience and notice period are required; heard-from is not', () => {
  const errors = validateProfile(normaliseProfile({}));
  assert.deepEqual(Object.keys(errors).sort(), ['city', 'experience', 'noticePeriod', 'qualification']);

  const withoutSource = validateProfile(normaliseProfile({ ...VALID, heardFrom: '' }));
  assert.deepEqual(withoutSource, {});
});

test('a value that is not on the list is refused, for every dropdown', () => {
  for (const field of ['qualification', 'experience', 'heardFrom', 'noticePeriod']) {
    const errors = validateProfile(normaliseProfile({ ...VALID, [field]: 'Something else' }));
    assert.deepEqual(Object.keys(errors), [field]);
  }
});

test('near-misses are refused too: the lists are matched exactly', () => {
  // A hyphen where the list has an en dash, and different case.
  assert.ok(validateProfile(normaliseProfile({ ...VALID, experience: '1-2 years' })).experience);
  assert.ok(validateProfile(normaliseProfile({ ...VALID, noticePeriod: '1 MONTH' })).noticePeriod);
});

test('the city is length-bounded like the other text fields', () => {
  assert.equal(validateProfile(normaliseProfile({ ...VALID, city: 'x'.repeat(120) })).city, undefined);
  assert.equal(validateProfile(normaliseProfile({ ...VALID, city: 'x'.repeat(121) })).city, 'That city name is too long');
});

test('normalisation trims, turns non-strings into blanks, and drops unknown keys', () => {
  const clean = normaliseProfile({
    city: '  Durban  ',
    qualification: { toString: () => 'Diploma' },
    experience: ['None yet'],
    noticePeriod: 7,
    salary: 'R100000',
  });
  assert.deepEqual(clean, { city: 'Durban', qualification: '', experience: '', heardFrom: '', noticePeriod: '' });
});

test('what is stored: the five fields, with an unanswered heard-from as null', () => {
  assert.deepEqual(profileForStorage(normaliseProfile({ ...VALID, heardFrom: '' })), {
    city: 'Cape Town',
    qualification: 'Matric / NSC',
    experience: '1–2 years',
    heardFrom: null,
    noticePeriod: '1 month',
  });
});
