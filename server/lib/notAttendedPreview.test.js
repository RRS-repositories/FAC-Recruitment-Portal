import test from 'node:test';
import assert from 'node:assert/strict';

import { PREVIEW_TOKEN, previewNotAttended } from './notAttended.js';
import { REBOOK_WARN_HOURS } from './rebookPolicy.js';

/**
 * The confirm dialog's preview.
 *
 * What is pinned here is that it READS and never writes, and that a refusal is
 * explained rather than rendered. The eligible path -- the real email, rendered
 * the way the outbox renders it -- is checked end to end against a database,
 * because it runs the templates' own queries.
 */

const ID = '11111111-2222-3333-4444-555555555555';

/** A database that answers the preview's three reads and fails any write. */
function fakeDb({ applicant, interview, offerExists = false }) {
  const seen = [];
  return {
    seen,
    connect() {
      throw new Error('the preview must not open a transaction');
    },
    async query(sql) {
      seen.push(sql);
      if (/^\s*(UPDATE|INSERT|DELETE)/i.test(sql) || /FOR UPDATE/i.test(sql)) {
        throw new Error(`the preview must not write or lock: ${sql.slice(0, 60)}`);
      }
      if (/FROM recruit_applicants/.test(sql)) return { rows: applicant ? [applicant] : [] };
      if (/offer_exists/.test(sql)) return { rows: [{ offer_exists: offerExists }] };
      if (/FROM recruit_interviews/.test(sql)) return { rows: interview ? [interview] : [] };
      throw new Error(`unexpected query: ${sql.slice(0, 60)}`);
    },
  };
}

const accepted = { id: ID, status: 'accepted', do_not_rehire: false, email: 'a@example.com', full_name: 'A Example', role: 'india_intern' };
const NOW = new Date('2026-09-15T12:00:00Z');

test('an interview that has not started is explained, not offered', async () => {
  const db = fakeDb({
    applicant: accepted,
    interview: { id: 'i1', status: 'booked', starts_at: '2026-09-15T15:00:00Z', is_final_chance: false },
  });
  const r = await previewNotAttended({ applicantId: ID, db, now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.eligible, false);
  assert.equal(r.code, 'not_started');
  assert.equal(r.email, undefined, 'no email is rendered for a refusal');
});

test('a second press after a re-book was offered is explained', async () => {
  const db = fakeDb({
    applicant: accepted,
    interview: { id: 'i1', status: 'no_show', starts_at: '2026-09-15T10:00:00Z', is_final_chance: false },
    offerExists: true,
  });
  const r = await previewNotAttended({ applicantId: ID, db, now: NOW });
  assert.equal(r.eligible, false);
  assert.equal(r.code, 'offer_exists');
});

test('someone already barred is explained', async () => {
  const db = fakeDb({ applicant: { ...accepted, status: 'declined', do_not_rehire: true }, interview: null });
  const r = await previewNotAttended({ applicantId: ID, db, now: NOW });
  assert.equal(r.code, 'do_not_rehire');
});

test('an unknown or malformed id is a 404, and nothing is queried for a malformed one', async () => {
  const db = fakeDb({ applicant: null, interview: null });
  assert.equal((await previewNotAttended({ applicantId: 'not-a-uuid', db })).status, 404);
  assert.equal(db.seen.length, 0);
  assert.equal((await previewNotAttended({ applicantId: ID, db })).status, 404);
});

test('the placeholder link cannot be mistaken for a working one', () => {
  assert.match(PREVIEW_TOKEN, /created-when-you-confirm/);
  assert.ok(PREVIEW_TOKEN.length < 64, 'not shaped like a real token');
});

test('the dashboard warns two days before a re-book link runs out', () => {
  assert.equal(REBOOK_WARN_HOURS, 48);
});
