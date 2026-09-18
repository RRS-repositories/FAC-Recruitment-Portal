import indiaPhoto from '@/assets/role-india.jpg';
import southAfricaPhoto from '@/assets/role-south-africa.jpg';
import salesPhoto from '@/features/sales/assets/sales-hero.jpg';
import { SALES_PATH } from '@/features/sales/paths';
import aiDevPhoto from '@/features/aidev/assets/aidev-hero.jpg';
import { AIDEV_PATH } from '@/features/aidev/paths';

/**
 * Role marketing content — and nothing else.
 *
 * The assessment questions used to live here, which meant their `score`
 * weights were compiled into the JavaScript bundle every visitor downloads: a
 * candidate with devtools open could read exactly which answer was worth three
 * marks. Making the repository private would not have fixed that, because the
 * leak was in the built bundle rather than the source.
 *
 * Questions now live in `server/lib/questions.js` and reach the form through
 * `GET /api/recruit/roles/:slug` with every score stripped. Everything in this
 * file is public copy — the same words that appear on the page.
 *
 * A third role is a new entry here plus a route; no component changes.
 */

export const ROLES = {
  // Keyed by the URL slug. `apiKey` is what the database stores and does
  // NOT change with the URL — the two are deliberately separate, so a
  // marketing decision about a link cannot reach the enum in a column.
  intern: {
    key: 'intern',
    apiKey: 'india_intern',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    tzLabel: 'IST',
    short: 'India · Internship',
    title: 'Paralegal Internship',
    location: 'Remote from India',
    contractType: 'Paid internship → full-time contract',
    source: 'Internshala',
    // From the prototype. `photoPosition` is the object-position it was
    // cropped at there — the faces sit off-centre, and centring them instead
    // cuts the head off at card height.
    photo: indiaPhoto,
    photoPosition: '60% 30%',
    pill: 'Now hiring · Paralegal Interns · Remote from India',
    headline: ['Come join', 'the team.'],
    sub: "We're one of the UK's fastest-growing law firms, with huge growth ahead. Build a real legal career with a team that recovers millions for people who've been treated unfairly.",
    whyHeading: "Why we're hiring in India",
    why: "Our India team is a core part of the business, not a back office. We're expanding fast and want sharp, motivated law graduates and students who want hands-on UK casework from day one.",
    contract:
      'This is a paid internship with a genuine route to a full-time permanent contract. Many of our current senior team members in India started exactly here.',
    need: [
      'A law degree, or final-year law student',
      'Strong written English',
      'Reliable internet and a quiet place to work',
      'Willing to work UK-aligned hours (typically 1:30 PM – 10:30 PM IST)',
    ],
    stats: [
      { value: '20+', label: 'Team members in India' },
      { value: '£12M+', label: 'Recovered for clients' },
      { value: '7 days', label: 'Average time to interview' },
      { value: '100%', label: 'Remote' },
    ],
  },

  paralegal: {
    key: 'paralegal',
    apiKey: 'sa_paralegal',
    country: 'South Africa',
    countryCode: 'ZA',
    timezone: 'Africa/Johannesburg',
    tzLabel: 'SAST',
    short: 'South Africa · Full-time',
    title: 'Paralegal — Full-time',
    location: 'Remote from South Africa',
    contractType: 'Full-time permanent contract',
    source: 'Direct',
    photo: southAfricaPhoto,
    photoPosition: '50% 25%',
    pill: 'Now hiring · Paralegals · Remote from South Africa',
    headline: ['Real casework.', 'From day one.'],
    sub: "Join one of the UK's fastest-growing law firms as a full-time paralegal, working remotely from South Africa on live consumer claims that change people's finances.",
    whyHeading: "Why we're hiring in South Africa",
    why: 'Our South Africa team handles case preparation and client care end to end. Native-level English and a working day that overlaps the UK make it a natural fit — and the work is genuine legal practice, not admin.',
    contract:
      'This is a full-time permanent position from the start, with structured progression and the same training our UK team receives.',
    need: [
      'LLB, paralegal qualification, or equivalent legal experience',
      'Excellent written and spoken English',
      'Reliable internet and a quiet place to work',
      'Able to work UK hours (typically 10:00 AM – 6:00 PM SAST)',
    ],
    stats: [
      { value: 'Full-time', label: 'Permanent contract' },
      { value: '£12M+', label: 'Recovered for clients' },
      { value: '7 days', label: 'Average time to interview' },
      { value: '100%', label: 'Remote' },
    ],
  },

  // Sales has its own page and form (features/sales/) — a voice note, a
  // different submit endpoint and its own design — so it does NOT use
  // RoleLandingPage or ApplyPage. `path` is where the home page card links;
  // App.jsx sends /recruitment/apply/sales there too. The copy below is the
  // sales design's own words, kept in the same shape as the entries above so
  // anything iterating ROLES (home cards, dashboard filter) reads it the same.
  sales: {
    key: 'sales',
    apiKey: 'sa_sales',
    path: SALES_PATH,
    country: 'South Africa',
    countryCode: 'ZA',
    timezone: 'Africa/Johannesburg',
    tzLabel: 'SAST',
    short: 'South Africa · Sales',
    title: 'Sales & Customer Service',
    location: 'Cape Town / Johannesburg / remote SA',
    contractType: 'Permanent, full-time role',
    source: 'Direct',
    photo: salesPhoto,
    // Where the sales design crops it on a phone: both faces stay in frame.
    photoPosition: '38% 30%',
    pill: 'Now hiring · Cape Town / Johannesburg / remote SA',
    headline: ['Sales & customer service.', 'South Africa.'],
    sub: "Join one of the UK's fastest-growing law firms. You'll speak to people who may have been treated unfairly by lenders and bookmakers — and help them do something about it.",
    whyHeading: 'What the role is',
    why: "You'll call people who've enquired about a claim, explain in plain English who we are and how it works, and sign up the ones we can genuinely help. You'll also look after existing clients — answering questions, keeping them updated and making sure nobody feels forgotten.",
    contract:
      "We're an SRA-regulated law firm. That means honesty on every call, no pressure tactics and no promises we can't keep. If you're good at talking to people and you like a target, you'll do well here.",
    need: [
      'Permanent, full-time role',
      'UK hours: 9:00 AM – 6:00 PM UK time',
      '45-min lunch plus a 15-min afternoon break',
      'Full training on our claims and scripts',
    ],
    stats: [
      { value: '£12m+', label: 'recovered for clients' },
      { value: '120+', label: 'staff across UK, SA & India' },
      { value: 'R13k', label: 'on-target monthly earnings' },
      { value: 'UK hrs', label: '9am – 6pm, Mon–Fri' },
    ],
  },

  // AI Developer has its own page and form too (features/aidev/, built on
  // the same role-page kit as sales) — so, like sales, it does NOT use
  // RoleLandingPage or ApplyPage. `path` is where the home page card links;
  // App.jsx sends /recruitment/apply/ai-developer there too. The copy is the
  // AI developer design's own words, in the same shape as the entries above.
  'ai-developer': {
    key: 'ai-developer',
    apiKey: 'india_aidev',
    path: AIDEV_PATH,
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    tzLabel: 'IST',
    short: 'India · AI Developer',
    title: 'AI Developer',
    location: 'Remote from India',
    contractType: 'Full-time, permanent',
    source: 'Direct',
    photo: aiDevPhoto,
    // The developer sits right of centre; this keeps his face in a card.
    photoPosition: '72% 30%',
    pill: 'Now hiring · Remote, India · UK hours',
    headline: ['AI developer.', 'Build the platform with us.'],
    sub: "We're a UK law firm building our own AI-driven CRM, automation and agent platform. We need a developer who already understands CRMs, workflows and LLM tooling — and wants to build something bigger.",
    whyHeading: "What you'd be building",
    why: 'We run a custom CRM, an email-processing AI (ECHOE), WhatsApp document-collection workflows, an AI customer-service team and an AI "office" of agents that work inside the CRM. All of it is built and hosted by us. You\'ll join the team extending it.',
    contract:
      "This isn't a ticket-queue job. You'll take a feature from a plain-English brief through design, build, test and deploy, working directly with our UK head of development and using AI coding tools as a normal part of the workflow.",
    need: [
      'Real experience with CRM systems — the data model, integrations and the messy edges',
      "Automations you've built and kept running: n8n, Make, custom code, webhooks, queues",
      'Production use of LLM APIs — structured outputs, tool calls, cost and error handling',
      'Comfortable on a Linux VPS with Docker, Postgres and Git',
    ],
    stats: [
      { value: '1 CRM', label: 'built in-house, 20k+ clients' },
      { value: '50+', label: 'live automations & agents' },
      { value: 'Remote', label: 'work from anywhere in India' },
      { value: 'UK hrs', label: '9am – 6pm UK, Mon–Fri' },
    ],
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export const getRole = (key) => ROLES[key] ?? null;
