# FAC Recruitment Portal

Recruitment portal for Fast Action Claims: the public application flow,
interview booking, and the manager dashboard.

```
client/     React 18 + Vite + Tailwind — application pages and dashboard
server/     Express 5 + PostgreSQL — applications, review, booking, email
shared/     Scoring and AI-detection, imported by both halves
```

## Quick start

```bash
cd server && cp .env.example .env   # then fill it in
npm install && npm run migrate
npm run dev                         # http://127.0.0.1:5000

cd ../client
npm install
npm run dev                         # http://localhost:5173
```

Run both: the Vite dev proxy forwards `/api` to the server, mirroring
production, where nginx serves the built client and proxies `/api` on the same
origin — so CORS never has to exist.

`shared/` is imported by the client through the `@shared` alias, so a client
build needs the repository root, not just `client/`.

## The backend is designed to be mounted

`createRecruitRouter()` lets the CRM host this API inside its own Express app
rather than running a second service. Standalone (`npm start`) is for
development and for running it on its own if that is ever wanted; either way the
portal keeps **its own database** and does not connect to the CRM's.

## The Atlas Recruitment website has moved

The marketing site previously lived here under `atlas-recruitment-website/`. It
is now `RRS-repositories/Atlas-Recruitment-Website`. History up to the split
remains in this repository, including commit `ff5b683`, which holds the intake
service and admin inbox that were removed when the backend moved here.

## Rules

See [CLAUDE.md](CLAUDE.md) for the standing rules that govern work in this repo —
branch → PR → merge, never push to `main`, and the data-hygiene constraints that
apply because this repository is public and the data is real.
