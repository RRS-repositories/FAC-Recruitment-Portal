-- atlas_enquiries_001
-- Website enquiry intake for the Atlas Recruitment marketing site.
--
-- Runs against the `atlas` cluster (127.0.0.1:5434) ONLY. That cluster has its
-- own postmaster, data directory and role namespace, so `atlas_app` does not
-- exist in the CRM's `main` cluster and `client_credentials` is unreachable
-- from here by any credential. Nothing in this file touches an existing object.
--
-- Length CHECKs mirror FIELD_LIMITS in src/utils/validators.js. Change one,
-- change both.

CREATE TABLE IF NOT EXISTS atlas_enquiries (
    id              bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      timestamptz  NOT NULL DEFAULT now(),

    name            text         NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    company         text         CHECK (company   IS NULL OR length(company)   <= 160),
    email           text         NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    phone           text         CHECK (phone     IS NULL OR length(phone)     <= 40),
    role_type       text         CHECK (role_type IS NULL OR length(role_type) <= 60),
    headcount       text         CHECK (headcount IS NULL OR length(headcount) <= 10),
    message         text         CHECK (message   IS NULL OR length(message)   <= 4000),

    source          text         NOT NULL DEFAULT 'website',
    user_agent      text         CHECK (user_agent IS NULL OR length(user_agent) <= 500),

    -- Salted SHA-256 of the client IP. Enough to investigate a flood; the raw
    -- address, which is personal data, is never written to disk.
    ip_hash         text         CHECK (ip_hash IS NULL OR length(ip_hash) = 64),

    status          text         NOT NULL DEFAULT 'new'
                                 CHECK (status IN ('new', 'contacted', 'closed', 'spam')),

    -- Notification outbox state. The row itself is the queue: notified_at NULL
    -- means "still to send", and notify_next_attempt_at carries the backoff so
    -- a failing mail server is retried on a schedule rather than in a hot loop.
    notified_at            timestamptz,
    notify_attempts        smallint     NOT NULL DEFAULT 0,
    notify_next_attempt_at timestamptz  NOT NULL DEFAULT now(),
    notify_error           text         CHECK (notify_error IS NULL OR length(notify_error) <= 500)
);

-- Inbox view: newest enquiry first.
CREATE INDEX IF NOT EXISTS idx_atlas_enquiries_created_at
    ON atlas_enquiries (created_at DESC);

-- "Has this person contacted us before?" and subject-access requests, which
-- arrive by email address and must not table-scan.
CREATE INDEX IF NOT EXISTS idx_atlas_enquiries_email_lower
    ON atlas_enquiries (LOWER(email));

-- The outbox the notifier polls, ordered by when each row is next due. Partial,
-- so it only ever holds the handful of rows still awaiting a notification
-- rather than one entry per enquiry ever received — it stays a couple of pages
-- regardless of how large the table grows.
CREATE INDEX IF NOT EXISTS idx_atlas_enquiries_outbox
    ON atlas_enquiries (notify_next_attempt_at)
    WHERE notified_at IS NULL AND status <> 'spam';
