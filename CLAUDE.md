# CLAUDE.md — Atlas Recruitment (standing rules for Claude Code)

The Atlas Recruitment marketing site. React 18 + Vite + Tailwind, plain JavaScript
(`.jsx`, never `.tsx`). Deployed to the on-prem box `crm-prod` alongside the CRM.

## The two standing rule documents govern this repo too

They apply to **every `RRS-repositories` repo**, not just `CRM-Finalised`. Read and
obey both in every session:

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
> reference them by environment-variable name only.

## Project layout

This repo holds the **website only**. It is a static frontend with no backend of
its own — the FAC recruitment portal owns the enquiry API and the database.

```
atlas-recruitment-website/   the React site (this is where all the work is)
```

Inside it: copy lives in `src/data/`, page sections in `src/components/sections/`,
anything reused twice in `src/components/ui/`. Adding a section means one data
entry plus one presentational component — no other file should need to change.

```
atlas-recruitment-website/src/
├─ App.jsx                  Route table; secondary pages lazy-loaded
├─ pages/                   One file per route
├─ components/
│  ├─ layout/               Navbar, Footer, Layout, ScrollManager
│  ├─ ui/                   Container, Button, Reveal, Icon, Flag, SectionHeading…
│  └─ sections/             home/ · founder/ · enquire/
├─ data/                    All copy, separated from markup
├─ hooks/                   useInView, useCountUp, useScrolled, usePageMeta…
├─ utils/                   cn.js, validators.js
└─ styles/index.css         Tailwind layers + the few global rules
```

## Conventions that are load-bearing

- **Design tokens live in `tailwind.config.js`.** Never hard-code a hex value in a
  component. `gold` (#d4a84b) is for dark surfaces only — it is 2.0:1 on cream and
  fails WCAG AA. Use `gold-deep` (#8a6a12) for accent *text* on light surfaces.
- **No animation library.** Scroll reveals run on a self-disconnecting
  `IntersectionObserver` (`hooks/useInView.js`) driving CSS transitions, so nothing
  runs on scroll after first paint. Every motion path must be disabled under
  `prefers-reduced-motion` while leaving the content visible.
- **Accessibility is not optional here** and has been verified: skip link, visible
  gold focus ring, `aria-expanded` on the mobile menu with Escape restoring focus,
  a focusable error summary on the enquiry form, WCAG AA contrast throughout.
  Re-verify after touching any of it.
- **Inline SVG, never emoji, for icons and flags.** Regional-indicator flag emoji
  render as bare letter pairs ("AE", "ZA") on Windows — that is why
  `components/ui/Flag.jsx` exists.
- **Client-side validation is UX, never a trust boundary.** `utils/validators.js`
  is shared with the server so the two can never disagree.

## Before saying a change works

```bash
npm run build     # must be clean
npm run dev       # then check the change in a browser
```

Verify at 320 / 390 / 768 / 1440px. The page body must never scroll sideways.

## Known state — read before planning work

- The site ships **placeholder content inherited from the client's demo**: the phone
  number is not dialable, the WhatsApp and Privacy-policy links point at `/`, and the
  testimonials, headline statistics and founder biography are unverified. Do not treat
  any of it as fact, and do not help publish it as fact.
- **The enquiry form has nowhere to submit to yet, and says so.** This site has no
  backend; the FAC portal will expose the API. Until then `VITE_ENQUIRY_ENDPOINT`
  is unset and the form tells the visitor to phone or email instead of showing a
  success panel for an enquiry nobody received. Point that variable at the portal
  when it exists — no code change needed.
- An intake service and admin inbox were built here and then removed when the
  backend moved to the FAC portal. If any of it is useful there —
  validation, honeypot/timing checks, the notification outbox, the migration —
  recover it from commit `ff5b683` rather than rewriting it.
- Production deploys to `/opt/atlas` on `crm-prod`, published through a Cloudflare
  tunnel to local nginx. TLS terminates at Cloudflare's edge; the box has no
  certificate and listens on port 80 only.
