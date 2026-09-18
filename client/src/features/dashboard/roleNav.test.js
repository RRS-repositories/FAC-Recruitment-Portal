import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  APPLICANTS_PATH,
  ROLE_APPLICANTS_BASE,
  applicantsPathFor,
  roleHeading,
  roleNavItems,
  roleNavLabel,
  routeRoleKey,
} from './roleNav.js';

// data/roles.js imports images, which node cannot load, so the fields these
// helpers read are taken from its source text instead: each entry's key,
// country and navName, in file order. A role added without a navName fails
// here rather than quietly showing its full job title in the menu.
const ROLES_SOURCE = readFileSync(new URL('../../data/roles.js', import.meta.url), 'utf8');
const ROLES = Object.fromEntries(
  [...ROLES_SOURCE.matchAll(
    /\n {2}(?:'[\w-]+'|\w+): \{\n {4}key: '([\w-]+)',[\s\S]*?\n {4}country: '([^']+)',[\s\S]*?\n {4}title: '([^']+)',\n(?: {4}\/\/.*\n)* {4}navName: '([^']+)',/g,
  )].map(([, key, country, title, navName]) => [key, { key, country, title, navName }]),
);

test('the four roles come out of ROLES with exactly the menu labels asked for', () => {
  assert.deepEqual(roleNavItems(ROLES), [
    { key: 'intern', to: '/admin/applicants/intern', label: 'India – Intern' },
    { key: 'paralegal', to: '/admin/applicants/paralegal', label: 'South Africa – Paralegal' },
    { key: 'sales', to: '/admin/applicants/sales', label: 'South Africa – Sales' },
    { key: 'ai-developer', to: '/admin/applicants/ai-developer', label: 'India – AI Developer' },
  ]);
});

test('a future role appears on its own, named by its title until it has a navName', () => {
  const roles = { ...ROLES, ops: { key: 'ops', country: 'Kenya', title: 'Operations Lead' } };
  const items = roleNavItems(roles);
  assert.equal(items.length, 5);
  assert.deepEqual(items.at(-1), {
    key: 'ops',
    to: '/admin/applicants/ops',
    label: 'Kenya – Operations Lead',
  });
});

test('"all" and nothing are /admin, unchanged; a role is under /admin/applicants', () => {
  assert.equal(APPLICANTS_PATH, '/admin');
  assert.equal(applicantsPathFor('all'), '/admin');
  assert.equal(applicantsPathFor(undefined), '/admin');
  assert.equal(applicantsPathFor(null), '/admin');
  assert.equal(applicantsPathFor('sales'), `${ROLE_APPLICANTS_BASE}/sales`);
});

test('only a real role key in the URL is read as a filter', () => {
  assert.equal(routeRoleKey(ROLES, 'sales'), 'sales');
  assert.equal(routeRoleKey(ROLES, 'ai-developer'), 'ai-developer');
  assert.equal(routeRoleKey(ROLES, undefined), null);
  assert.equal(routeRoleKey(ROLES, 'nope'), null);
  // Inherited names are not roles.
  assert.equal(routeRoleKey(ROLES, 'toString'), null);
  assert.equal(routeRoleKey(ROLES, '__proto__'), null);
});

test('the header band names the role', () => {
  assert.equal(roleHeading(ROLES.sales), 'South Africa · Sales applicants');
  assert.equal(roleHeading(ROLES.intern), 'India · Intern applicants');
  assert.equal(roleNavLabel(ROLES['ai-developer']), 'India – AI Developer');
});
