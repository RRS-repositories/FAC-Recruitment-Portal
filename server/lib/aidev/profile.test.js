import test from 'node:test';
import assert from 'node:assert/strict';

import { AIDEV_DETAIL_OPTIONS } from './questions.js';
import { normaliseProfile, profileForStorage, validateProfile } from './profile.js';

/**
 * The AI Developer details step: dropdowns accept only their own lists, the
 * GitHub link is optional but must be a real web link when given, and nothing
 * the form did not ask for survives normalisation.
 */

const VALID = {
  city: 'Testville',
  qualification: 'B.Tech / B.E.',
  experience: '3–5 years',
  githubUrl: 'https://github.com/example',
  employer: 'Example Ltd',
  heardFrom: 'Naukri',
  noticePeriod: '1 month',
};

const check = (over) => validateProfile(normaliseProfile({ ...VALID, ...over }));

test('a complete profile has no errors', () => {
  assert.deepEqual(check({}), {});
});

test('every option in every list is accepted', () => {
  const lists = {
    qualification: AIDEV_DETAIL_OPTIONS.qualifications,
    experience: AIDEV_DETAIL_OPTIONS.experience,
    heardFrom: AIDEV_DETAIL_OPTIONS.heardFrom,
    noticePeriod: AIDEV_DETAIL_OPTIONS.noticePeriods,
  };
  for (const [field, options] of Object.entries(lists)) {
    for (const value of options) assert.deepEqual(check({ [field]: value }), {}, `${field}: ${value}`);
  }
});

test('the lists match the design, without its blank placeholder', () => {
  assert.deepEqual(AIDEV_DETAIL_OPTIONS.qualifications, [
    'B.Tech / B.E.', 'BCA / B.Sc (CS/IT)', 'MCA / M.Tech', 'Other degree', 'Diploma / self-taught',
  ]);
  assert.deepEqual(AIDEV_DETAIL_OPTIONS.experience, ['Under 1 year', '1–2 years', '3–5 years', '5–8 years', '8+ years']);
  assert.deepEqual(AIDEV_DETAIL_OPTIONS.heardFrom, [
    'LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Referral from a friend', 'Other',
  ]);
  assert.deepEqual(AIDEV_DETAIL_OPTIONS.noticePeriods, [
    'Available immediately', '2 weeks', '1 month', '2 months', '3 months',
  ]);
  for (const list of Object.values(AIDEV_DETAIL_OPTIONS)) assert.ok(!list.includes(''));
});

test('city, qualification, experience and notice period are required -- in the form\'s order', () => {
  const errors = validateProfile(normaliseProfile({}));
  assert.deepEqual(Object.keys(errors), ['city', 'qualification', 'experience', 'noticePeriod']);
  assert.equal(errors.experience, 'Choose your years of development experience');
});

test('the GitHub link, the employer and heard-from are optional', () => {
  assert.deepEqual(check({ githubUrl: '', employer: '', heardFrom: '' }), {});
});

test('a value that is not on the list is refused, for every dropdown', () => {
  for (const field of ['qualification', 'experience', 'heardFrom', 'noticePeriod']) {
    assert.deepEqual(Object.keys(check({ [field]: 'Something else' })), [field]);
  }
  // Near-misses too: a hyphen where the list has an en dash, and the sales
  // role's own spelling of a value this role does not offer.
  assert.ok(check({ experience: '1-2 years' }).experience);
  assert.ok(check({ experience: 'None yet' }).experience);
  assert.ok(check({ qualification: 'Matric / NSC' }).qualification);
});

test('githubUrl: any http(s) link with a host is accepted', () => {
  for (const url of [
    'https://github.com/example',
    'http://example.com',
    'https://gitlab.com/example/project',
    'https://example.dev/portfolio?tab=work#top',
    'HTTPS://GITHUB.COM/EXAMPLE',
  ]) {
    assert.deepEqual(check({ githubUrl: url }), {}, url);
  }
});

test('githubUrl: anything that is not an http(s) link is refused', () => {
  for (const url of [
    'github.com/example',
    'www.github.com/example',
    'javascript:alert(1)',
    'ftp://example.com/file',
    'mailto:someone@example.com',
    'https://',
    'not a link',
    'data:text/html,hello',
  ]) {
    assert.equal(check({ githubUrl: url }).githubUrl, 'Enter a full link, starting with https://', url);
  }
});

test('githubUrl: 300 characters is the limit', () => {
  const at = `https://github.com/${'a'.repeat(300 - 'https://github.com/'.length)}`;
  assert.equal(at.length, 300);
  assert.deepEqual(check({ githubUrl: at }), {});
  assert.equal(check({ githubUrl: `${at}a` }).githubUrl, 'That link is too long');
});

test('employer: 120 characters is the limit; city like every other text field', () => {
  assert.deepEqual(check({ employer: 'x'.repeat(120) }), {});
  assert.equal(check({ employer: 'x'.repeat(121) }).employer, 'That employer name is too long');
  assert.equal(check({ city: 'x'.repeat(121) }).city, 'That city name is too long');
});

test('errors come back in the form\'s order', () => {
  const errors = validateProfile(
    normaliseProfile({
      city: '',
      qualification: 'x',
      experience: 'x',
      githubUrl: 'nope',
      employer: 'x'.repeat(121),
      heardFrom: 'x',
      noticePeriod: '',
    }),
  );
  assert.deepEqual(Object.keys(errors), [
    'city', 'qualification', 'experience', 'githubUrl', 'employer', 'heardFrom', 'noticePeriod',
  ]);
});

test('normalisation trims, turns non-strings into blanks, and drops unknown keys', () => {
  const clean = normaliseProfile({
    city: '  Pune  ',
    qualification: { toString: () => 'MCA / M.Tech' },
    experience: ['8+ years'],
    githubUrl: '  https://github.com/example  ',
    employer: 42,
    noticePeriod: 7,
    salary: '100000',
    voice: 'x',
  });
  assert.deepEqual(clean, {
    city: 'Pune',
    qualification: '',
    experience: '',
    githubUrl: 'https://github.com/example',
    employer: '',
    heardFrom: '',
    noticePeriod: '',
  });
});

test('what is stored: seven fields, each unanswered optional one as null', () => {
  assert.deepEqual(profileForStorage(normaliseProfile(VALID)), VALID);
  assert.deepEqual(profileForStorage(normaliseProfile({ ...VALID, githubUrl: '', employer: '  ', heardFrom: '' })), {
    city: 'Testville',
    qualification: 'B.Tech / B.E.',
    experience: '3–5 years',
    githubUrl: null,
    employer: null,
    heardFrom: null,
    noticePeriod: '1 month',
  });
});
