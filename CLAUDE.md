# CLAUDE.md — FAC Recruitment Portal (standing rules for Claude Code)

The Fast Action Claims recruitment portal: public application pages, interview
booking, and the manager dashboard. React 18 + Vite + Tailwind on the front,
Express 5 + PostgreSQL behind. Plain JavaScript (`.jsx`, never `.tsx`).

The Atlas Recruitment marketing site used to live here under
`atlas-recruitment-website/`. It now has its own repository,
`RRS-repositories/Atlas-Recruitment-Website`. History up to the split stays
here — including commit `ff5b683`, which holds the removed intake service.

## The two standing rule documents govern this repo too

They apply to **every `RRS-repositories` repo**. Read and obey both in every
session:

- `E:\RRC\GIT-WORKFLOW-RULES.md` — *how* changes reach `main`.
- `CRM-Finalised/docs/DATA-HYGIENE-RULES.md` — *what* may go into the repo.

The essentials, repeated here so they cannot be missed:

- **Never commit or push to `main`.** Branch → Pull Request → merge.
- **Never force-push.** If a push is rejected, `git pull --rebase` — never `-f`.
- **Never resolve a conflict by discarding the other side.** Keep both changes.
- **Never deploy by copying or editing files on the server.** Production runs the
  exact merged `main`.
- Start every task with `git checkout main && git pull`.
- Enable the client-side guard once per clone: `git config core.hooksPath .githooks`.

> **This repo is public.** Never commit internal IPs, SSH usernames, VPN details,
> credentials, or real client data. That includes the on-prem host addresses —
> reference them by environment-variable name only. Candidate data is real
> personal data: never paste it into an issue, a commit message, or a test.

## Project layout

```
client/     React SPA — public application flow and the manager dashboard
server/     Express API — applications, review, booking, email
shared/     Code both halves must agree on. Not a copy — the same file.
```

`shared/scoring.js` and `shared/aiDetect.js` are imported by the client through
the `@shared` alias and by the server directly. **The client build depends on
`shared/`**, so `client/` is not independently checkout-able — a build needs the
repository root.

## Conventions that are load-bearing

- **The client and API are same-origin, deliberately.** `client/src/lib/api.js`
  is the single place the client talks to the API, and it builds relative
  `/api/...` URLs. There is no base URL to configure and **CORS does not exist
  anywhere** — nginx serves the build and proxies `/api` in production, and
  `vite.config.js` mirrors that in development. Do not add a base-URL variable
  to "make it flexible"; that reintroduces CORS and a class of bug this design
  removes.
- **The server is mountable.** `createRecruitRouter()` exists so a host
  application — the CRM — can mount this API inside its own Express app. Keep it
  that way: no top-level side effects that assume standalone, and close only a
  pool we opened (`ownsPool()`).
- **The portal has its own database.** It does **not** connect to the CRM's.
  Schema changes go through `server/migrations/` and `npm run migrate`, never a
  hand-run `ALTER`.
- **Client-side validation is UX, never a trust boundary.** Anything that
  matters is revalidated server-side.
- **Scheduling is anchored to UK time.** Availability lives in `Europe/London`
  and is converted outward per candidate; a fixed 09:00 UK slot is 13:30 IST in
  summer and 14:30 in winter. That shift is correct and is pinned by
  `server/lib/timezone.test.js` — do not "fix" it.
- **Failures must be visible, not silent.** With `SMTP_HOST` unset, email is
  composed to disk and the dashboard says so; with `TURNSTILE_SECRET_KEY` unset,
  no spam check runs and Settings says so. Preserve that pattern: degrade
  loudly, never pretend.

## Before saying a change works

```bash
cd client && npm run build     # must be clean
cd server && npm test          # must pass
```

Then run both and check in a browser. Verify at 320 / 390 / 768 / 1440px; the
page body must never scroll sideways.

## Known state — read before planning work

- **The backend is being deployed inside the CRM**, not as a standalone service.
  The CRM must mount `createRecruitRouter()` at `/api/recruit`, and the portal
  still needs its own database, `CV_STORAGE_DIR` on the large disk, and the
  secrets in `server/.env.example`.
- **Port 5000 is already taken on the production box** by the CRM backend, so the
  default `PORT=5000` cannot be used there.
- **CVs must not be written under the publicly served rclone root.** See the
  comment on `CV_STORAGE_DIR` in `server/.env.example`.
- **`PUBLIC_BASE_URL` must end in `/recruitment`.** Booking links are composed
  from it, and `/book/:token` without that prefix reaches nothing under the
  candidate-facing nginx rule. The admin screens have their own rule at `/admin`.
- **Admin auth is interim** — per-manager credentials so the audit trail records
  who decided, to be replaced by Cloudflare Access. `/admin` sits on the same
  hostname as the public form, so it needs an access policy before that hostname
  is public.

## Deployment

The client is a static build; nginx serves `client/dist` and proxies `/api` to
whichever process hosts the router. `BrowserRouter` means the host **must**
serve `index.html` for unknown paths:

```nginx
location / { try_files $uri $uri/ /index.html; }
```

Production is the on-prem box (`crm-prod`), published through a Cloudflare
tunnel to local nginx. TLS terminates at Cloudflare's edge; the box has no
certificate and listens on port 80 only.

> **Never SIGHUP `cloudflared` on that box to pick up an ingress change.** It
> terminates the process instead of reloading, and because it exits cleanly
> systemd does not restart it — taking every tunnelled service down with it.
> Use `sudo systemctl restart cloudflared`.
