-- recruit_005_blackouts
-- Time the interviewer is not available, and the feature flags from spec §2.
--
-- BLACKOUTS
--
-- Spec §5 rule 6 blocks slots against the interviewer's own Google Calendar,
-- so meetings he books himself also close the portal. That route needs an
-- account the firm owns, and the interviewer uses a personal address — which
-- domain-wide delegation cannot reach.
--
-- This is the part of that requirement we can meet without any calendar at
-- all: he says when he is unavailable, and those slots disappear. The
-- availability engine already subtracts a list of busy periods to keep two
-- candidates out of one slot; a blackout joins the same list. When calendar
-- access does arrive, its busy periods join that list too and nothing here
-- has to change.
--
-- Spec §8.3 asks for exactly this under "Out of office".

BEGIN;

CREATE TABLE recruit_blackouts (
  id               bigserial PRIMARY KEY,
  interviewer_id   integer NOT NULL REFERENCES recruit_interviewers(id) ON DELETE CASCADE,

  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,

  -- Shown back to whoever set it, so a wall of dates in a list is
  -- recognisable a month later. Never shown to a candidate: they see a slot
  -- that is not on offer, not the reason it is not.
  reason           text CHECK (reason IS NULL OR length(reason) <= 120),

  created_by_email citext,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blackout_ends_after_start CHECK (ends_at > starts_at)
);

-- The availability query asks "what covers this window, for this interviewer".
CREATE INDEX idx_recruit_blackouts_interviewer ON recruit_blackouts (interviewer_id, starts_at, ends_at);

-- DELETE is granted here, unlike the audit and the outbox. A blackout is a
-- statement about the future rather than a record of something that happened,
-- and one entered by mistake should be removable rather than crossed out.
GRANT SELECT, INSERT, UPDATE, DELETE ON recruit_blackouts TO :"app_role";
GRANT USAGE, SELECT ON SEQUENCE recruit_blackouts_id_seq TO :"app_role";

/*
 * FEATURE FLAGS — spec §2, all default OFF.
 *
 * The spec's go-live plan depends on these: everything runs dark, Brad reads
 * the shadow results, and only then is anything switched on. Without them
 * there is no way to deploy without immediately being live.
 *
 * They live in recruit_settings so they can be flipped without a deploy,
 * which is the entire point of a flag.
 *
 * `recruitment_alerts` covers outbound notifications. The spec's alert is a
 * pop-up in the CRM; ours is email, and the flag means the same thing either
 * way — whether the system reaches out to a real person. With it off, an
 * application is still taken and a decision still recorded; the email is
 * called off and says so, so nobody is emailed by a shadow run and a manager
 * can see exactly who to contact by hand.
 */
INSERT INTO recruit_settings (key, value) VALUES
  ('flags.recruitment_portal',  'false'::jsonb),
  ('flags.recruitment_booking', 'false'::jsonb),
  ('flags.recruitment_alerts',  'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
