# atlas-intake

Receives enquiries from the Atlas Recruitment website and stores them. One
route, one table, one pm2 process.

## Why it is a separate service with a separate database

Existing CRM data must not be reachable from a public form. That is enforced by
architecture rather than by care: the Atlas data lives in its **own PostgreSQL
cluster** on port 5434, created with `pg_createcluster`. Roles are per-cluster,
so `atlas_app` does not exist in the CRM's `main` cluster on 5432 and
`client_credentials` cannot be addressed from here by any credential this
service holds. No `GRANT` or `REVOKE` is ever issued against the CRM cluster.

`db.mjs` refuses to start if pointed at port 5432, and so does the migration
runner.

## Setup

```bash
# 1. Create the cluster (once, as root on the box)
sudo pg_createcluster 17 atlas --port 5434 --start

# 2. Create the database and the least-privilege role
sudo -u postgres psql -p 5434 -c "CREATE DATABASE atlas_recruitment"
sudo -u postgres psql -p 5434 -c "CREATE ROLE atlas_app LOGIN PASSWORD '…'"
sudo -u postgres psql -p 5434 -d atlas_recruitment -c "GRANT USAGE ON SCHEMA public TO atlas_app"

# 3. Configure
cp server/.env.example server/.env    # then fill it in
openssl rand -hex 32                  # -> ATLAS_IP_HASH_SALT

# 4. Apply the migration (Brad runs this — see the house rule below)
npm run migrate:dry                   # list what would apply
npm run migrate

# 5. Grant the application role its table privileges
sudo -u postgres psql -p 5434 -d atlas_recruitment <<'SQL'
GRANT SELECT, INSERT ON atlas_enquiries TO atlas_app;
GRANT UPDATE (status, notified_at, notify_attempts, notify_next_attempt_at, notify_error)
  ON atlas_enquiries TO atlas_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO atlas_app;
SQL

# 6. Run
npm run server                        # or: pm2 start server/ecosystem.config.cjs
```

Note there is **no `DELETE` grant**. Retention purges run as a separate
scheduled role, so a bug in the web-facing service cannot erase enquiry history.

> **House rule: Claude writes migrations, Brad applies them.** Nothing in
> `migrations/` runs automatically.

## The endpoint

`POST /api/enquiries` — same origin as the site, so no CORS anywhere.

| Status | When | Body |
|---|---|---|
| `201` | Stored | `{ ok: true, id }` |
| `400` | Validation failed | `{ ok: false, errors: { field: message } }` |
| `429` | Rate limit hit | `{ ok: false, error }` |
| `503` | Database unreachable | `{ ok: false, error }` |

`GET /api/health` returns `{ ok: true }` when the database answers.

Validation is authoritative here and shares `src/utils/validators.js` with the
React form, so the two cannot disagree about what a valid email is. The server
additionally allowlists the two dropdowns and discards unknown keys.

## Bot handling

A honeypot field, a minimum time-to-submit, and a per-IP rate limit. No CAPTCHA
— it costs the visitor, worst of all a screen-reader user, and the cheaper
signals are enough at this volume.

A caught bot receives the same `201` a real submission gets, while the row is
written with `status = 'spam'`. Telling a bot it was detected only teaches
whoever wrote it to try again differently, and keeping the rows means the
filter's accuracy can be audited rather than assumed.

## Notifications

The enquiry row is the queue. The request writes it and returns; a poller sends
the email and stamps `notified_at`, with exponential backoff in
`notify_next_attempt_at`. Redis is on this box but belongs to the CRM — using it
would couple the marketing site to CRM infrastructure for no gain here.

**Off by default.** `ENQUIRY_NOTIFY_ENABLED=false` means enquiries are still
captured; unsent rows wait in the outbox until it is switched on. Nothing is
lost while it is off.

Delivery is at-least-once. A crash between sending and stamping re-sends that
enquiry — a duplicate notification is a much better failure than a lost one.

## Backups

`ops/nightly-backup.sh` on the box dumps `client_credentials` **by name** and
will not pick up this cluster. It must be extended, or enquiries are the only
data on the box with no backup:

```bash
sudo -u postgres pg_dump -p 5434 -Fc atlas_recruitment > "$BK/atlas-db-$TS.dump"
```

## Data protection

Every row is personal data. The raw IP is never stored — only a salted
SHA-256 — enquiry contents are never written to logs, and the
`LOWER(email)` index exists so a subject-access request is one indexed query.
A published privacy notice is a precondition for switching this on.
