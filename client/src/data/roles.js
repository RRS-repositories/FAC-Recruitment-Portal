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
};

export const ROLE_KEYS = Object.keys(ROLES);

export const getRole = (key) => ROLES[key] ?? null;
