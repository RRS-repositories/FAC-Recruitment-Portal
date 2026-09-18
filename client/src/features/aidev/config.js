/**
 * AI Developer (India, remote) — everything the shared role-page kit
 * (features/role-page/) needs to draw this role's form.
 *
 * Plain data and pure functions, no React and no `@/` imports, so it can be
 * checked under `node --test` (config.test.js). The React wiring is in
 * AiDevPage.jsx.
 *
 * Four steps and no voice note. Only what the server does not send lives
 * here: the seven written questions, the twelve technical questions and the
 * upload limit come from `GET /api/recruit/roles/ai-developer`; the limit and
 * the lists below are used only while that is loading or if the server leaves
 * a field out.
 */
import { countWord, wholeMB } from '../role-page/helpers.js';
import { AIDEV_APPLY_PATH, AIDEV_PATH } from './paths.js';

export const AIDEV = {
  /** The server's slug: `/roles/ai-developer`, `/applications/ai-developer`, the `role` field. */
  slug: 'ai-developer',
  /** The entry in data/roles.js (its `source` goes with the application). */
  rolesKey: 'ai-developer',
  /** Prefix for element ids (`#aidev-email`), unique on the page. */
  idPrefix: 'aidev',
  path: AIDEV_PATH,
  applyPath: AIDEV_APPLY_PATH,

  meta: {
    title: 'AI Developer — Fast Action Claims Careers',
    description:
      'Remote AI developer role in India with Fast Action Claims, a UK law firm building its own AI-driven CRM, automation and agent platform. UK hours, ₹30,000 a month, full-time and permanent.',
  },

  /** The form band's small line. */
  brandLine: 'AI Developer · India (remote)',

  /** Form pages in order, with the progress bar's labels in the design's words. */
  steps: [
    { page: 'details', label: 'Your details' },
    { page: 'written', label: 'Your experience' },
    { page: 'assessment', label: 'Technical assessment' },
    { page: 'cv', label: 'CV & submit' },
  ],

  /**
   * The details grid, in the design's order. `name` is also the multipart
   * field. As designed, the portfolio link, the employer and "where did you
   * hear" are optional; a portfolio link, if given, must be a web address.
   */
  detailFields: [
    { name: 'fullName', label: 'Full name', kind: 'text', placeholder: 'e.g. Arjun Mehta', autoComplete: 'name', required: true },
    { name: 'email', label: 'Email address', kind: 'text', type: 'email', placeholder: 'you@example.com', autoComplete: 'email', required: true, check: 'email' },
    { name: 'phone', label: 'Mobile number', kind: 'text', type: 'tel', placeholder: '+91 98000 00000', autoComplete: 'tel', required: true },
    { name: 'city', label: 'City', kind: 'text', placeholder: 'e.g. Pune', autoComplete: 'address-level2', required: true },
    { name: 'qualification', label: 'Highest qualification', kind: 'select', list: 'qualifications', required: true },
    { name: 'experience', label: 'Years of professional development experience', kind: 'select', list: 'experience', required: true },
    {
      name: 'githubUrl',
      label: 'GitHub / portfolio URL',
      labelHint: '(optional)',
      kind: 'text',
      type: 'url',
      placeholder: 'https://github.com/…',
      autoComplete: 'url',
      check: 'url',
      message: 'Please check your GitHub / portfolio URL — it should start with https://',
    },
    { name: 'employer', label: 'Current / most recent employer', kind: 'text', placeholder: 'Company name', autoComplete: 'organization' },
    { name: 'heardFrom', label: 'Where did you hear about this role?', kind: 'select', list: 'heardFrom' },
    { name: 'noticePeriod', label: 'Notice period', kind: 'select', list: 'noticePeriods', required: true },
  ],

  /** The prototype's dropdown lists — used only if the server sends none. */
  fallbackDetailOptions: {
    qualifications: [
      'B.Tech / B.E.',
      'BCA / B.Sc (CS/IT)',
      'MCA / M.Tech',
      'Other degree',
      'Diploma / self-taught',
    ],
    experience: ['Under 1 year', '1–2 years', '3–5 years', '5–8 years', '8+ years'],
    heardFrom: ['LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Referral from a friend', 'Other'],
    noticePeriods: ['Available immediately', '2 weeks', '1 month', '2 months', '3 months'],
  },

  defaultLimits: {
    cvMaxBytes: 10 * 1024 * 1024,
  },

  /** No role-only steps. */
  extraStepErrors: {},

  /** The design's words for the shared steps. */
  copy: {
    detailsTitle: 'Your details',
    detailsSub: "We'll only use these to contact you about this application.",
    detailsNotice: {
      lead: 'Write your own answers, in this form.',
      body: ' We record pasted text, auto-filled text and typing patterns, and we check for AI-written answers. Anything flagged goes to the hiring manager and counts against you. Short, real, slightly messy answers beat polished generated ones every time.',
    },
    detailsError: 'Please complete every required field (and check your email address).',
    writtenTitle: 'Your experience',
    writtenSub:
      "Specific and honest. We'd rather read 80 real words than 300 generic ones. Minimum word counts are shown.",
    writtenSpellCheck: true,
    assessmentTitle: 'Technical assessment',
    assessmentSub: (count) =>
      `${countWord(count)} situations from the actual job. Pick what you'd really do — no time limit, no trick questions.`,
    assessmentNext: 'Continue to CV',
    cvSub: (maxBytes) =>
      `Last step. PDF or Word, up to ${wholeMB(maxBytes)} MB. A link to your GitHub in the CV helps.`,
    cvConfirm:
      "By submitting you confirm your answers are your own work and the information you've given is accurate.",
    thanksReceived: 'your answers, your assessment and your CV',
    thanksNext:
      "If you're shortlisted, the email will include a link to book a video interview — expect a short technical conversation with our head of development.",
  },
};

export default AIDEV;
