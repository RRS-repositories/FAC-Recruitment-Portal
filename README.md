# Atlas Recruitment

```
atlas-recruitment-website/   Marketing site — React + Vite + Tailwind, static
```

## Quick start

```bash
cd atlas-recruitment-website
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

See [atlas-recruitment-website/README.md](atlas-recruitment-website/README.md) for
the full structure, design tokens and conventions, and [CLAUDE.md](CLAUDE.md) for
the standing rules that govern work in this repo.

## There is no backend here

The site is a static frontend. The **FAC recruitment portal** owns the enquiry
API and the database — enquiry submissions will be posted to it once it exists.

Until then the form has no endpoint, and it says so rather than pretending:
submitting shows the phone number and email address instead of a success panel.
Switching it on is a build-time variable, not a code change:

```bash
VITE_ENQUIRY_ENDPOINT=https://<portal-host>/api/enquiries npm run build
```

An intake service and admin inbox previously lived in this repo and were removed
when the backend moved to the portal. The parts worth reusing there — shared
validation, honeypot and timing checks, the notification outbox, and the
`atlas_enquiries` migration — are in git history at commit `ff5b683`.

## Deploying

`npm run build` emits a static `dist/`. The app uses `BrowserRouter`, so the host
must serve `index.html` for unknown paths — `public/_redirects` (Netlify) and
`vercel.json` (Vercel) are included. For nginx:

```nginx
location / { try_files $uri $uri/ /index.html; }
```
