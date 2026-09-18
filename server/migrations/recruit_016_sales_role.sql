-- recruit_016 — the Sales & Customer Service (South Africa) role.
--
-- A third role, with two things the other two do not have: a details step
-- (city, qualification, experience, notice period, where they heard of us)
-- and a recorded voice note, because the job is on the phone.
--
-- Everything here is additive and nullable, with no defaults, so adding it
-- rewrites no row: every existing application reads exactly as it did, and
-- the intern and paralegal forms never touch these columns at all.

-- ── The role ────────────────────────────────────────────────────────────────
--
-- ALTER TYPE ... ADD VALUE is allowed inside a transaction block (PostgreSQL
-- 12+; production runs 17), which is how the runner applies every migration.
-- The one restriction is that the new value cannot be USED until that
-- transaction commits -- so nothing below compares against, casts to or
-- inserts 'sa_sales'. The CHECK constraint further down is on voice_source,
-- not role, for exactly that reason.
--
-- IF NOT EXISTS so a re-run, or a database where somebody already added it by
-- hand, is a no-op rather than a failure.
ALTER TYPE recruit_role ADD VALUE IF NOT EXISTS 'sa_sales';

-- ── The details step ────────────────────────────────────────────────────────
--
-- One jsonb column rather than five text ones. The fields are specific to one
-- role, NULL for the other two, and the list of what we ask is the kind of
-- thing that changes after the first week of real applications. The API
-- validates every value against its dropdown list on the way in
-- (server/lib/sales/profile.js), which is where a bad one can be refused with
-- a sentence a human can read.
ALTER TABLE recruit_applicants
  ADD COLUMN IF NOT EXISTS profile jsonb;

-- ── The voice note ──────────────────────────────────────────────────────────
--
-- Stored like the CV: on disk under CV_STORAGE_DIR, in the applicant's own
-- directory, addressed by a fixed name -- never under the publicly served
-- rclone root. These columns only say where it is and what it is.
ALTER TABLE recruit_applicants
  -- `<applicant id>/voice.<ext>`, relative to CV_STORAGE_DIR.
  ADD COLUMN IF NOT EXISTS voice_object_key   text,
  -- What the candidate called it, for the download. Never used in a path.
  ADD COLUMN IF NOT EXISTS voice_filename     text,
  -- Decided from the file's own bytes, not the browser's claim.
  ADD COLUMN IF NOT EXISTS voice_mime         text,
  ADD COLUMN IF NOT EXISTS voice_size_bytes   integer,
  -- As measured by the candidate's browser; the server does not decode audio.
  ADD COLUMN IF NOT EXISTS voice_duration_sec integer,
  -- 'recorded' on the page, or 'uploaded' from a file.
  ADD COLUMN IF NOT EXISTS voice_source       text,
  -- The voice note's twin of cv_deleted_at (recruit_006): set when the
  -- recording is removed, so "there was a voice note and it has been
  -- deleted" reads differently from "there never was".
  ADD COLUMN IF NOT EXISTS voice_deleted_at   timestamptz;

-- Two values, both chosen by the application, so a CHECK costs nothing to
-- keep and stops a typo becoming a third category in a later count.
ALTER TABLE recruit_applicants
  DROP CONSTRAINT IF EXISTS recruit_applicants_voice_source_check;
ALTER TABLE recruit_applicants
  ADD CONSTRAINT recruit_applicants_voice_source_check
  CHECK (voice_source IS NULL OR voice_source IN ('recorded', 'uploaded'));
