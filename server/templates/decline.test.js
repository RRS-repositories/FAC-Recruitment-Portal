import test from 'node:test';
import assert from 'node:assert/strict';

import { getTemplate } from '../lib/templates.js';
import './index.js';
import { declineReapply, declineSentence, DECLINE_REASONS } from '../../shared/declineReasons.js';

/**
 * The decline email, read as the candidate reads it.
 *
 * `templates.test.js` covers the registry; this covers the wording, because
 * the wording is the part a person is actually affected by. Two things here
 * are worth breaking a build over: an email that invents a reason nobody gave,
 * and an invitation to apply again that the database would then refuse.
 */

const KEYS = ['recruit.india.decline', 'recruit.sa.decline'];

const render = (key, code, note) =>
  getTemplate(key).render({
    firstName: 'Priya',
    declineSentence: declineSentence(code, note),
    declineReapply: declineReapply(code),
    reapplyUrl: 'https://example.invalid/recruitment',
  });

for (const key of KEYS) {
  test(`${key}: no reason says nothing about a reason and offers nothing`, () => {
    const out = render(key, 'none');
    assert.doesNotMatch(out.text, /apply again/i);
    assert.doesNotMatch(out.html, /Apply again/);
    // Still a complete letter: greeting, decision, sign-off.
    assert.match(out.text, /^Dear Priya,/);
    assert.match(out.text, /Kind regards,/);
  });

  test(`${key}: a reason the candidate can act on carries the invitation and a button`, () => {
    for (const code of ['ai_used', 'answers_generic']) {
      const out = render(key, code);
      assert.match(out.text, /you are welcome to apply again/i, code);
      assert.match(out.text, /Apply again: https:\/\/example\.invalid\/recruitment/, code);
      // In HTML it must be a real button, not a bare link in a paragraph.
      assert.match(out.html, /<a[^>]+href="https:\/\/example\.invalid\/recruitment"[^>]*>[\s\S]*?Apply again/, code);
    }
  });

  test(`${key}: a reason the candidate cannot act on does not invite them back`, () => {
    // Inviting somebody to reapply against "not enough experience" wastes
    // their evening and our inbox. The reason is still given.
    for (const code of ['experience', 'role_fit', 'incomplete']) {
      const out = render(key, code);
      assert.doesNotMatch(out.text, /apply again/i, code);
      assert.match(out.text, new RegExp(declineSentence(code).slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), code);
    }
  });

  test(`${key}: "other" gives the manager's words and no invitation`, () => {
    // We have no idea whether a reason somebody typed is one the candidate
    // could put right, so the email does not promise that it is.
    const out = render(key, 'other', 'You withdrew from the process.');
    assert.match(out.text, /You withdrew from the process\./);
    assert.doesNotMatch(out.text, /apply again/i);
  });

  test(`${key}: the invitation is a paragraph of its own, not run into the reason`, () => {
    const out = render(key, 'ai_used');
    assert.match(out.text, /did not read as your own work\.\n\nIf you would like to be considered/);
  });
}

test('the India decline no longer claims a high volume of applications', () => {
  // Removed at the client's request. Pinned because it is the sort of line
  // that gets pasted back in from the prototype copy.
  const out = render('recruit.india.decline', 'none');
  assert.doesNotMatch(out.text, /high volume|competitive/i);
  assert.doesNotMatch(out.html, /high volume|competitive/i);
});

test('every reason that invites a reapply also gives a reason', () => {
  // An invitation with no explanation reads as a form letter sent twice.
  for (const r of DECLINE_REASONS) {
    if (declineReapply(r.code)) {
      assert.ok(declineSentence(r.code), `${r.code} invites a reapply, so it must explain why`);
    }
  }
});

test('the preview a manager sees renders without a database', () => {
  for (const key of KEYS) {
    const tpl = getTemplate(key);
    const out = tpl.render(tpl.sample);
    assert.ok(out.subject && out.text && out.html);
    assert.match(out.text, /apply again/i, 'the preview should show the invitation, not hide it');
  }
});
