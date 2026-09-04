-- recruit_001_core
-- Core schema for the FAC recruitment portal.
--
-- Runs against the portal's OWN database (fac_recruitment). It does not
-- reference, read or touch the CRM. The build spec's schema used
-- `REFERENCES users(id)` for the interviewer and the deciding manager, which
-- would have forced these tables into the CRM database because PostgreSQL
-- foreign keys cannot cross databases. Two changes remove that coupling
-- without losing anything real:
--
--   * interviewers get their own table here — there is one interviewer, and a
--     dedicated table carries what scheduling actually needs (calendar id,
--     timezone) which a generic users row would not;
--   * the deciding manager is recorded as the email Cloudflare Access
--     verified, so there is no user table to maintain and no second login.
--
-- Everything else follows the spec's §3.

CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed by the no-double-booking constraint below

CREATE TYPE recruit_role      AS ENUM ('india_intern', 'sa_paralegal');
CREATE TYPE recruit_status    AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE interview_status  AS ENUM ('not_invited', 'invited', 'booked', 'attended', 'no_show', 'cancelled');


-- ── Interviewers ────────────────────────────────────────────────────────────
-- One row today (Priyanshu). A table rather than a constant because the
-- calendar id and timezone are per-person, and because adding a second
-- interviewer later should be an INSERT, not a migration.
CREATE TABLE recruit_interviewers (
  id                  serial PRIMARY KEY,
  full_name           text    NOT NULL,
  email               citext  NOT NULL UNIQUE,
  -- The calendar the Google event is created on. 'primary' means the
  -- impersonated account's own calendar.
  google_calendar_id  text    NOT NULL DEFAULT 'primary',
  -- Display only. Scheduling is anchored to the availability rule's timezone,
  -- not this one — see recruit_availability_rules.
  personal_timezone   text    NOT NULL DEFAULT 'Asia/Kolkata',
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ── Applicants ──────────────────────────────────────────────────────────────
CREATE TABLE recruit_applicants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role             recruit_role NOT NULL,

  full_name        text   NOT NULL CHECK (length(full_name) BETWEEN 1 AND 120),
  email            citext NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  phone            text   CHECK (phone IS NULL OR length(phone) <= 40),

  written_answers  jsonb NOT NULL,   -- {w1, w2, w3}
  mcq_answers      jsonb NOT NULL,   -- {q1: 2, q2: [0,1], ...}

  -- Computed server-side from the option weights. The client sends its own
  -- score for display only; this column is never populated from it.
  rule_score       smallint NOT NULL CHECK (rule_score BETWEEN 0 AND 100),
  ai_score         smallint CHECK (ai_score IS NULL OR ai_score BETWEEN 0 AND 100),

  -- AI-use detection (spec §13). Populated in stage 8; the telemetry that
  -- feeds it is captured at submission in stage 2, because it cannot be
  -- reconstructed afterwards.
  ai_use_level     text CHECK (ai_use_level IS NULL OR ai_use_level IN ('clean', 'possible', 'ai_used')),
  ai_use_score     smallint CHECK (ai_use_score IS NULL OR ai_use_score BETWEEN 0 AND 100),
  ai_use_reasons   jsonb,
  telemetry        jsonb,

  started_at       timestamptz NOT NULL,
  duration_sec     integer CHECK (duration_sec IS NULL OR duration_sec >= 0),

  -- The dashboard sorts and filters on this, so it is stored rather than
  -- computed per query. Switches to the AI score automatically once stage 8
  -- populates it — no application change needed.
  final_score      smallint GENERATED ALWAYS AS (COALESCE(ai_score, rule_score)) STORED,

  cv_object_key    text,   -- storage path; backend chosen in stage 2
  cv_filename      text,

  status           recruit_status NOT NULL DEFAULT 'pending',
  -- The Access-verified email of whoever decided. No users table, no second
  -- login to maintain.
  decided_by_email citext,
  decided_at       timestamptz,

  candidate_tz     text NOT NULL,   -- 'Asia/Kolkata' | 'Africa/Johannesburg'
  source           text,            -- 'internshala' | 'direct' | utm
  ip_hash          text CHECK (ip_hash IS NULL OR length(ip_hash) = 64),

  created_at       timestamptz NOT NULL DEFAULT now(),

  -- A decision must record who made it and when, or neither.
  CONSTRAINT decided_fields_together CHECK (
    (status = 'pending'  AND decided_by_email IS NULL AND decided_at IS NULL)
    OR (status <> 'pending' AND decided_by_email IS NOT NULL AND decided_at IS NOT NULL)
  )
);

-- Dashboard default view: newest first, filtered by status.
CREATE INDEX idx_recruit_applicants_status_created ON recruit_applicants (status, created_at DESC);
-- The role pills.
CREATE INDEX idx_recruit_applicants_role_status    ON recruit_applicants (role, status);
-- One application per role per person (spec §3).
CREATE UNIQUE INDEX idx_recruit_applicants_email_role ON recruit_applicants (email, role);


-- ── Interviews ──────────────────────────────────────────────────────────────
CREATE TABLE recruit_interviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id          uuid NOT NULL REFERENCES recruit_applicants(id) ON DELETE CASCADE,
  interviewer_id        integer NOT NULL REFERENCES recruit_interviewers(id),

  -- Spec §3 says the token is UNIQUE; §12 says it is stored hashed. Following
  -- §12 — the raw token is emailed and never persisted, so a database leak
  -- does not hand out working booking links.
  booking_token_hash    text NOT NULL UNIQUE CHECK (length(booking_token_hash) = 64),
  token_expires_at      timestamptz NOT NULL,

  status                interview_status NOT NULL DEFAULT 'invited',
  starts_at             timestamptz,
  ends_at               timestamptz,

  gcal_event_id         text,
  meet_link             text,

  candidate_joined_at   timestamptz,
  interviewer_joined_at timestamptz,
  reminder_24h_sent     boolean NOT NULL DEFAULT false,
  reminder_10m_sent     boolean NOT NULL DEFAULT false,
  reschedule_count      smallint NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ends_after_starts CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  -- Anything that has happened or is scheduled must carry a time. 'cancelled'
  -- is deliberately not listed: a cancelled interview keeps the slot it had,
  -- which is what makes "they cancelled twice" answerable later.
  CONSTRAINT booked_has_time CHECK (
    status NOT IN ('booked', 'attended', 'no_show')
    OR (starts_at IS NOT NULL AND ends_at IS NOT NULL)
  ),

  -- THE double-booking guarantee. The application also takes an advisory lock
  -- and re-checks before writing, but this makes it impossible rather than
  -- unlikely: two concurrent bookings for the same slot cannot both commit,
  -- regardless of application logic, retries or a second process.
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    interviewer_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'booked' AND starts_at IS NOT NULL)
);

CREATE INDEX idx_recruit_interviews_interviewer_time ON recruit_interviews (interviewer_id, starts_at);
CREATE INDEX idx_recruit_interviews_status_time      ON recruit_interviews (status, starts_at);
CREATE INDEX idx_recruit_interviews_applicant        ON recruit_interviews (applicant_id);


-- ── Availability rules ──────────────────────────────────────────────────────
-- Stored in the BUSINESS's timezone (Europe/London), not the interviewer's own.
-- Anchoring to his local IST day would have offered South African candidates
-- 05:30 slots; UK-anchored gives IST 13:30-21:30 and SAST 10:00-18:00. See
-- server/lib/timezone.js.
CREATE TABLE recruit_availability_rules (
  id                serial PRIMARY KEY,
  interviewer_id    integer NOT NULL REFERENCES recruit_interviewers(id) ON DELETE CASCADE,
  timezone          text NOT NULL DEFAULT 'Europe/London',
  weekdays          smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',   -- ISO: 1 = Monday
  day_start         time NOT NULL DEFAULT '09:00',
  day_end           time NOT NULL DEFAULT '17:00',               -- a slot must END by this
  slot_minutes      smallint NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  buffer_minutes    smallint NOT NULL DEFAULT 0  CHECK (buffer_minutes >= 0),
  min_notice_hours  smallint NOT NULL DEFAULT 24 CHECK (min_notice_hours >= 0),
  max_days_ahead    smallint NOT NULL DEFAULT 14 CHECK (max_days_ahead BETWEEN 1 AND 365),
  blocks            jsonb NOT NULL DEFAULT '[{"start":"11:30","end":"12:30","label":"Lunch"}]',
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT day_end_after_start CHECK (day_end > day_start),
  CONSTRAINT one_rule_per_interviewer UNIQUE (interviewer_id)
);


-- ── Application sessions ────────────────────────────────────────────────────
-- Required by spec §13.4 but never defined in §3. Two jobs: it lets the server
-- verify the client's claimed start time instead of trusting it, and rows left
-- with completed_at NULL are the "started but didn't finish" figure Brad asked
-- for on the dashboard.
CREATE TABLE recruit_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role          recruit_role NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  applicant_id  uuid REFERENCES recruit_applicants(id) ON DELETE SET NULL,
  ip_hash       text CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  user_agent    text CHECK (user_agent IS NULL OR length(user_agent) <= 500)
);

-- Partial: only the abandoned ones, so the drop-off count stays cheap however
-- many applications accumulate.
CREATE INDEX idx_recruit_sessions_abandoned ON recruit_sessions (started_at)
  WHERE completed_at IS NULL;


-- ── Settings ────────────────────────────────────────────────────────────────
-- Also referenced by §13.3 but never defined. Thresholds and the AI phrase
-- list live here so they can be tuned without a deploy.
CREATE TABLE recruit_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ── Audit ───────────────────────────────────────────────────────────────────
-- Append-only. The application role is granted INSERT and SELECT only — see
-- recruit_002_roles.sql — so history cannot be rewritten by the app.
CREATE TABLE recruit_audit (
  id            bigserial PRIMARY KEY,
  applicant_id  uuid NOT NULL,
  actor_email   citext,          -- NULL = system
  action        text NOT NULL CHECK (length(action) <= 60),
  payload       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recruit_audit_applicant ON recruit_audit (applicant_id, created_at DESC);
