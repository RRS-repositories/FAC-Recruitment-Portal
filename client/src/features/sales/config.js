/**
 * Sales & Customer Service (South Africa) — everything the shared role-page
 * kit (features/role-page/) needs to draw this role's form.
 *
 * Plain data and pure functions, no React and no `@/` imports, so it can be
 * checked under `node --test` (config.test.js). The React wiring — the
 * landing and the voice step — is in SalesPage.jsx.
 *
 * Only what the server does not send lives here. The written questions, the
 * scenario questions and the upload limits come from
 * `GET /api/recruit/roles/sales`; the limits and lists below are used only
 * while that is loading or if an older server leaves a field out.
 */
import { countWord, wholeMB } from '../role-page/helpers.js';
import { SALES_APPLY_PATH, SALES_PATH } from './paths.js';
import { appendVoice } from './voiceHelpers.js';

export const SALES = {
  /** The server's slug: `/roles/sales`, `/applications/sales`, the `role` field. */
  slug: 'sales',
  /** The entry in data/roles.js (its `source` goes with the application). */
  rolesKey: 'sales',
  /** Prefix for element ids (`#sales-email`), unique on the page. */
  idPrefix: 'sales',
  path: SALES_PATH,
  applyPath: SALES_APPLY_PATH,

  meta: {
    title: 'Sales & Customer Service — Fast Action Claims Careers',
    description:
      "Sales and customer service in South Africa with Fast Action Claims, one of the UK's fastest-growing law firms. UK hours, R6,000 basic, R13,000 OTE.",
  },

  /** The form band's small line. */
  brandLine: 'Sales & Customer Service · South Africa',

  /** Form pages in order, with the progress bar's labels in the design's words. */
  steps: [
    { page: 'details', label: 'Your details' },
    { page: 'written', label: 'About you' },
    { page: 'assessment', label: 'Assessment' },
    { page: 'voice', label: 'Voice note' },
    { page: 'cv', label: 'CV & submit' },
  ],

  /**
   * The details grid, in the design's order. `name` is also the multipart
   * field. Every field but "where did you hear" is required, as designed.
   */
  detailFields: [
    { name: 'fullName', label: 'Full name', kind: 'text', placeholder: 'e.g. Thandi Nkosi', autoComplete: 'name', required: true },
    { name: 'email', label: 'Email address', kind: 'text', type: 'email', placeholder: 'you@example.com', autoComplete: 'email', required: true, check: 'email' },
    { name: 'phone', label: 'Mobile number', kind: 'text', type: 'tel', placeholder: '+27 82 000 0000', autoComplete: 'tel', required: true },
    { name: 'city', label: 'City / area', kind: 'text', placeholder: 'e.g. Cape Town', autoComplete: 'address-level2', required: true },
    { name: 'qualification', label: 'Highest qualification', kind: 'select', list: 'qualifications', required: true },
    { name: 'experience', label: 'Years of sales / call-centre experience', kind: 'select', list: 'experience', required: true },
    { name: 'heardFrom', label: 'Where did you hear about this role?', kind: 'select', list: 'heardFrom' },
    { name: 'noticePeriod', label: 'Notice period', kind: 'select', list: 'noticePeriods', required: true },
  ],

  /** The prototype's dropdown lists — used only if the server sends none. */
  fallbackDetailOptions: {
    qualifications: [
      'Matric / NSC',
      'Higher Certificate',
      'Diploma',
      "Bachelor's degree",
      'Honours / Postgraduate',
      'Other',
    ],
    experience: ['None yet', 'Under 1 year', '1–2 years', '3–5 years', '5+ years'],
    heardFrom: ['LinkedIn', 'Pnet / Careers24', 'Indeed', 'Referral from a friend', 'Facebook', 'Other'],
    noticePeriods: ['Available immediately', '1 week', '2 weeks', '1 month', 'More than 1 month'],
  },

  defaultLimits: {
    cvMaxBytes: 10 * 1024 * 1024,
    voiceMaxBytes: 25 * 1024 * 1024,
    voiceMaxSeconds: 7 * 60,
    voiceMinSeconds: 10,
  },

  /** Server field names owned by the role-only steps, for sending a refusal back there. */
  extraStepErrors: { voice: ['voice', 'voiceDuration', 'voiceSource'] },

  /** Adds the voice note to the multipart body, after the CV. */
  appendExtras: (form, extras) => appendVoice(form, extras.voice),

  /** The design's words for the shared steps. */
  copy: {
    detailsTitle: 'Your details',
    detailsSub: "We'll only use these to contact you about this application.",
    detailsNotice: {
      lead: 'Please write your own answers.',
      body: " We check for AI-written responses. Anything that looks generated is flagged to the hiring manager and will count against you. We'd much rather read your real words, spelling mistakes and all.",
    },
    detailsError: 'Please complete every field (and check your email address).',
    writtenTitle: 'About you',
    writtenSub:
      "Short, honest answers in your own words. Minimum word counts are shown — there's no maximum.",
    assessmentTitle: 'Scenario assessment',
    assessmentSub: (count) =>
      `${countWord(count)} real situations from the job. Pick the answer that's closest to what you'd actually do — there's no time limit.`,
    assessmentNext: 'Continue to voice note',
    cvSub: (maxBytes) => `Last step. PDF or Word, up to ${wholeMB(maxBytes)} MB.`,
    cvConfirm:
      "By submitting you confirm your answers are your own work and that the information you've given is accurate.",
    thanksReceived: 'your answers, your voice note and your CV',
    thanksNext:
      "If you're shortlisted, the email will include a link to book a video interview at a time that suits you.",
  },
};

export default SALES;
