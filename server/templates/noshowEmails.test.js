import test from 'node:test';
import assert from 'node:assert/strict';

import { getTemplate, describeTemplates } from '../lib/templates.js';
import './index.js';
import { fill, loadSupplied } from './supplied.js';

/**
 * The emails a "Not attended" press sends, and the one line added to the
 * booking confirmation.
 *
 * The re-book email is used exactly as supplied, so what is pinned is that
 * nothing about it is lost or mangled on the way out -- and that it can never
 * reach a candidate half-filled.
 */

const DATA = {
  firstName: 'Priya',
  fullName: 'Priya Example',
  roleTitle: 'Paralegal Internship',
  interviewerName: 'Priyanshu Srivastava',
  localDay: 'Mon 14 Sept',
  localTime: '14:30',
  ukTime: '10:00',
  token: 'TEST-TOKEN-123',
  startsAt: '2026-09-14T09:00:00.000Z',
  endsAt: '2026-09-14T09:30:00.000Z',
};

const rebook = () => getTemplate('recruit.noshow.rebook');

/* ── The supplied file, handled faithfully ───────────────────────────────── */

test('the supplied file loads, with its own subject and plain-text version', () => {
  const t = loadSupplied('email-noshow-rebook.html');
  assert.equal(t.subject, 'Missed interview — final opportunity to re-book');
  assert.ok(t.text && t.text.startsWith('Dear {{first_name}},'), 'plain text comes from the PLAIN-TEXT block');
});

test('the builder notes inside the file never reach a candidate', () => {
  const out = rebook().render(DATA);
  assert.doesNotMatch(out.html, /<!--/, 'no HTML comments left in the email');
  assert.doesNotMatch(out.html, /TEMPLATE:|PLAIN-TEXT|see spec/);
});

test('every merge field is filled — nothing reads "{{…}}"', () => {
  const out = rebook().render(DATA);
  assert.doesNotMatch(out.html, /\{\{/);
  assert.doesNotMatch(out.text, /\{\{/);
});

test('the wording is the supplied wording', () => {
  // Spot-checks of lines that must survive untouched (decided 15 Sep: keep the
  // whole email as it is).
  const out = rebook().render(DATA);
  for (const line of [
    'ACTION REQUIRED · FINAL OPPORTUNITY',
    'You missed your interview, Priya.',
    'other candidates were turned away from that slot',
    'Join the Google Meet link from your calendar invite',
    'Fast Action Claims, Rowan Rose Ltd, Beacon Legal Group or Atlas Recruitment',
    'silence will be treated as a no-show',
    'Re-book my interview',
  ]) {
    assert.ok(out.html.includes(line), `html keeps: ${line}`);
  }
});

test('it names the MISSED time, and carries the NEW booking link', () => {
  const out = rebook().render(DATA);
  assert.match(out.html, /was waiting for you at <strong>14:30 on Mon 14 Sept<\/strong> \(10:00 UK\)/);
  assert.match(out.text, /at 14:30 on Mon 14 Sept \(10:00 UK\)/);
  assert.match(out.html, /href="[^"]*\/book\/TEST-TOKEN-123"/);
  assert.match(out.text, /\/book\/TEST-TOKEN-123/);
});

test('it says 7 days, because the link lasts 7 days', () => {
  const out = rebook().render(DATA);
  assert.match(out.html, /Link valid for <strong>7 days<\/strong>/);
  assert.match(out.text, /valid 7 days/);
  assert.doesNotMatch(out.text, /14 days/);
});

test('the opt-in "strong warning" paragraph is absent', () => {
  const out = rebook().render(DATA);
  assert.doesNotMatch(out.html + out.text, /150 law firms|blacklist/i);
});

test('a name containing HTML cannot break the layout', () => {
  const out = rebook().render({ ...DATA, firstName: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(out.html, /<img src=x/);
  assert.match(out.html, /&lt;img src=x/);
  // The plain-text part is not HTML, so it is left as typed.
  assert.match(out.text, /Dear <img src=x/);
});

test('with no booking token it refuses rather than sending a broken link', () => {
  assert.throws(() => rebook().render({ ...DATA, token: undefined }), /no booking token/);
});

test('an unfilled field is an error, a deliberate blank is not', () => {
  assert.throws(() => fill('Hi {{first_name}} {{surname}}', { first_name: 'A' }), /unfilled fields: surname/);
  assert.equal(fill('A{{blank}}B', { blank: '' }), 'AB');
  assert.equal(fill('<{{x}}>', { x: '<b>' }, { html: true }), '<&lt;b&gt;>');
});

/* ── The final email ─────────────────────────────────────────────────────── */

test('the final email closes the application and offers no link', () => {
  const out = getTemplate('recruit.noshow.final').render(DATA);
  assert.match(out.subject, /closed/);
  assert.match(out.text, /application has now been closed/);
  assert.doesNotMatch(out.text + out.html, /\/book\//, 'nothing left to book');
  assert.match(out.text, /Mon 14 Sept at 14:30 \(10:00 UK time\)/);
});

/* ── The booking confirmation ────────────────────────────────────────────── */

test('an ordinary booking confirmation does not mention a final interview', () => {
  const out = getTemplate('recruit.booking.confirmed').render({ ...DATA, isFinalChance: false });
  assert.doesNotMatch(out.text + out.html, /final scheduled interview/);
});

test('a re-booked final chance adds exactly one line, and changes nothing else', () => {
  const plain = getTemplate('recruit.booking.confirmed').render({ ...DATA, isFinalChance: false });
  const final = getTemplate('recruit.booking.confirmed').render({ ...DATA, isFinalChance: true });

  const LINE = 'This is your final scheduled interview. Please ensure you attend.';
  assert.ok(final.text.includes(LINE));
  assert.ok(final.html.includes(LINE));
  assert.equal(final.subject, plain.subject);
  // Take the line (and its blank line) back out: what remains must be the
  // ordinary confirmation, byte for byte.
  assert.equal(final.text.replace(`${LINE}\n\n`, ''), plain.text);
});

/* ── The templates screen ────────────────────────────────────────────────── */

test('both new emails appear on the templates screen and preview without a database', () => {
  const described = describeTemplates();
  for (const key of ['recruit.noshow.rebook', 'recruit.noshow.final']) {
    const entry = described.find((t) => t.key === key);
    assert.ok(entry, `${key} is listed`);
    assert.ok(entry.preview?.html, `${key} previews`);
    assert.equal(entry.error ?? null, null, `${key} renders its own sample`);
  }
  // Approved 15 Sep: no longer labelled a draft.
  assert.doesNotMatch(described.find((t) => t.key === 'recruit.noshow.final').title, /DRAFT/);
});
