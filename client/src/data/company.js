/**
 * Firm-level content for the landing page.
 *
 * Every figure and claim here comes from the supplied prototype and build
 * spec — nothing is invented. Where the spec gave guidance on wording it is
 * followed: §10.6 asks for "one of the UK's fastest-growing law firms" rather
 * than "biggest", so that is what appears.
 */

export const COMPANY = {
  name: 'Fast Action Claims',
  legalEntity: 'Fast Action Claims is a trading style of Rowan Rose Ltd',
  // Named on its own for the booking page, which shows the legal entity
  // under the wordmark rather than the careers subtitle.
  parentEntity: 'Rowan Rose Ltd',
  regulator: 'Regulated by the Solicitors Regulation Authority',
  website: 'fastactionclaims.co.uk',
  websiteUrl: 'https://fastactionclaims.co.uk',

  tagline: 'Build a legal career that actually matters.',
  intro:
    "We're one of the UK's fastest-growing law firms, and we're hiring remotely in India and South Africa. Real casework, real clients, from your first month.",

  who: "Fast Action Claims is a UK-based, SRA-regulated solicitors practice that fights for consumers who've been treated unfairly by lenders and financial institutions. We recover money that is rightfully owed to our clients — and the teams who do that work sit in three countries.",

  stats: [
    { value: '£12M+', label: 'Recovered for clients' },
    { value: '120+', label: 'Team members worldwide' },
    { value: '3', label: 'Countries: UK, India, South Africa' },
    { value: '6', label: 'Specialist claim areas' },
  ],
};

/** The six practice areas named in the prototype. */
export const CLAIM_AREAS = [
  {
    icon: 'coins',
    title: 'Irresponsible lending',
    body: 'Loans that should never have been approved, and the harm they caused.',
  },
  {
    icon: 'heart',
    title: 'Gambling harm',
    body: 'Where operators kept taking money from people they should have protected.',
  },
  {
    icon: 'car',
    title: 'Car finance affordability',
    body: 'Agreements sold to people who could never realistically afford them.',
  },
  {
    icon: 'gavel',
    title: 'CCJ removal',
    body: 'Judgments recorded unfairly, and the credit damage that follows.',
  },
  {
    icon: 'wallet',
    title: 'Overdraft claims',
    body: 'Long-term overdraft charges that quietly outgrew the debt itself.',
  },
  {
    icon: 'receipt',
    title: 'IHT refunds',
    body: 'Inheritance tax overpaid, and reclaiming what the estate is owed.',
  },
];

/** What a paralegal here actually does — from the prototype's role pages. */
export const WHAT_YOU_DO = [
  'Manage active caseloads with real client files from day one',
  'Draft correspondence to lenders, clients and regulators',
  'Keep case records accurate in our CRM',
  'Handle data extraction and evidence preparation',
  'Support UK claims handlers through every stage',
];

/** The hiring process, matching what the portal actually does. */
export const HIRING_STEPS = [
  {
    icon: 'file',
    title: 'Apply online',
    body: 'About ten minutes. Your details, three written answers, a short assessment and your CV. No cover letter.',
  },
  {
    icon: 'search',
    title: 'We review within 48 hours',
    body: 'Every application is read by our team. You hear back either way — no silence.',
  },
  {
    icon: 'calendar',
    title: 'Pick your own interview slot',
    body: "If you're shortlisted you get a link and choose a time that suits you. No back-and-forth over email.",
  },
  {
    icon: 'video',
    title: 'Meet us on Google Meet',
    body: 'A 30-minute conversation with our Admin Manager. The invite lands in your calendar automatically.',
  },
];

/** Why work here — grounded in the role documents, not generic perk copy. */
export const WHY_JOIN = [
  {
    icon: 'briefcase',
    title: 'Real casework, not admin',
    body: 'You hold live files and speak to real outcomes. Our overseas teams are core to the business, not a back office.',
  },
  {
    icon: 'globe',
    title: 'Fully remote',
    body: 'Work from home in India or South Africa, on UK-aligned hours, with a team spread across three countries.',
  },
  {
    icon: 'shield',
    title: 'UK legal experience',
    body: 'Hands-on experience of UK consumer law that is difficult to get anywhere else from where you are.',
  },
  {
    icon: 'user',
    title: 'A route that goes somewhere',
    body: 'Many of our senior team started in exactly these roles. Interns have a genuine path to a permanent contract.',
  },
];

/** Answers to what candidates actually ask before applying. */
export const FAQS = [
  {
    q: 'Do I need UK legal experience already?',
    a: 'No. We need strong written English, a legal qualification or genuine legal interest, and the willingness to learn UK consumer law. We train you on the rest.',
  },
  {
    q: 'What hours would I work?',
    a: 'UK-aligned hours, so your day overlaps the UK team. That is typically 1:30 PM – 10:30 PM in India, and roughly 10:00 AM – 6:00 PM in South Africa.',
  },
  {
    q: 'How long does the application take?',
    a: 'About ten minutes. There is no cover letter — the written answers and short assessment are the application.',
  },
  {
    q: 'When will I hear back?',
    a: 'Within 48 hours. Every application is reviewed and you get an answer either way.',
  },
  {
    q: 'Is the internship paid?',
    a: 'Yes. The India role is a paid internship with a genuine route to a full-time permanent contract. The South Africa role is full-time and permanent from the start.',
  },
  {
    q: 'Can I use AI to write my answers?',
    a: 'Please do not. We check every application for AI-generated text, and answers that appear written by an AI tool are discredited. We are interested in how you think, not how polished the prose is.',
  },
];
