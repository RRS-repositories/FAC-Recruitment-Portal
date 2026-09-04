# Atlas Recruitment

Marketing site for Atlas Recruitment — offshore staffing, fully managed. Rebuilt
from the supplied demo in **React + Vite + Tailwind CSS** (plain JavaScript, no
TypeScript), with the original navy/gold theme and copy preserved.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in /dist
npm run preview  # serve the built bundle locally
```

Requires Node 18+.

## Folder structure

```
src/
├─ main.jsx                  App entry — Router + StrictMode
├─ App.jsx                   Route table; secondary pages are lazy-loaded
│
├─ pages/                    One file per route
│  ├─ HomePage.jsx
│  ├─ FounderPage.jsx
│  ├─ EnquirePage.jsx
│  └─ NotFoundPage.jsx
│
├─ components/
│  ├─ layout/                Persistent shell
│  │  ├─ Layout.jsx          Navbar + <Outlet/> + Footer
│  │  ├─ Navbar.jsx          Desktop nav + accessible mobile menu
│  │  ├─ Footer.jsx
│  │  └─ ScrollManager.jsx   Hash/route scroll behaviour
│  │
│  ├─ ui/                    Reusable primitives
│  │  ├─ Container.jsx       The single page gutter
│  │  ├─ Button.jsx          Link / anchor / button, three variants
│  │  ├─ SectionHeading.jsx  Eyebrow + heading + sub
│  │  ├─ Reveal.jsx          Scroll-reveal wrapper
│  │  ├─ Icon.jsx            Inline SVG icon set
│  │  ├─ Flag.jsx            Inline SVG country flags
│  │  ├─ Logo.jsx
│  │  ├─ BackToTop.jsx
│  │  └─ ClientLogoMarks.jsx Client wordmarks (inline SVG)
│  │
│  └─ sections/              Page sections, grouped by page
│     ├─ home/               Hero, LogoMarquee, WhatWeDo, Benefits,
│     │                      Industries, Offices, HowItWorks,
│     │                      Testimonials, WhyAtlas, CtaBand
│     ├─ founder/            FounderHero, FounderStory
│     └─ enquire/            ContactSection, EnquiryForm, Faqs
│
├─ data/                     All copy and content, separated from markup
│  ├─ home.js  founder.js  enquire.js
│  ├─ navigation.js  company.js  images.js
│
├─ hooks/
│  ├─ useInView.js           IntersectionObserver, self-disconnecting
│  ├─ useCountUp.js          Animated statistics
│  ├─ useScrolled.js         Navbar condense / back-to-top visibility
│  ├─ useLockBodyScroll.js   Mobile-menu scroll lock
│  ├─ usePrefersReducedMotion.js
│  └─ usePageMeta.js         Per-route <title> and description
│
├─ utils/                    cn.js (class join), validators.js (form rules)
├─ styles/index.css          Tailwind layers + the few global rules
└─ assets/images/            img01–img15.jpg
```

**The rule of thumb:** copy lives in `data/`, layout lives in `sections/`,
anything reused twice lives in `ui/`. Adding a section means adding an entry to
`data/` and one presentational component — no other file needs to change.

## Design tokens

The theme is defined once in `tailwind.config.js`, so nothing hard-codes a hex
value in a component:

| Token | Value | Used for |
|---|---|---|
| `navy` | `#0c1a3a` | Primary dark surface, headings |
| `navy-mid` / `slate-brand` | `#122349` / `#1c2f58` | Gradient partners |
| `navy-deep` | `#08132b` | Footer |
| `gold` | `#d4a84b` | Accent on dark surfaces, CTAs, borders |
| `gold-deep` | `#8a6a12` | Accent **text** on light surfaces (contrast) |
| `cream` | `#f7f5f1` | Alternating section background |
| `ink` / `muted` | `#26303f` / `#66707f` | Body / secondary text |

Fonts: **Playfair Display** (headings) and **Inter** (body), matching the demo.

## Animation

No animation library — everything is CSS transitions driven by a small
`IntersectionObserver` hook, which keeps the bundle down and avoids scroll
handlers running every frame.

- `Reveal` fades and lifts sections in as they enter the viewport, staggered
  across grid rows.
- Hero and founder statistics count up when scrolled into view.
- The client-logo strip scrolls infinitely and pauses on hover.
- Cards lift, images scale gently, the mobile menu slides, the logo mark turns.

Every one of these is disabled under `prefers-reduced-motion: reduce`, with the
content still fully visible.

## Accessibility

- Skip link, visible gold focus ring on every control, logical heading order.
- Mobile menu: `aria-expanded`, Escape closes and restores focus, and the closed
  panel's links are removed from the tab order.
- Enquiry form: visible labels, validation on blur, a focusable error summary
  linking to each invalid field, and `aria-invalid` / `aria-describedby` wiring.
- All text meets WCAG AA contrast (verified; worst case 5.95:1).
- Country flags and client logos are inline SVG rather than emoji, so they
  render identically on every platform.

## Deployment

`npm run build` emits a static `/dist`. The app uses `BrowserRouter`, so the
host must serve `index.html` for unknown paths — `public/_redirects` (Netlify)
and `vercel.json` (Vercel) are included. For nginx:

```nginx
location / { try_files $uri $uri/ /index.html; }
```
