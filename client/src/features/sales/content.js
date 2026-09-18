/**
 * Fixed copy and fallbacks for the sales page.
 *
 * Only what the server does not send lives here. The written questions, the
 * scenario questions and the upload limits come from
 * `GET /api/recruit/roles/sales`; the values below are used only while that
 * is loading or if an older server leaves a field out.
 */

/** The address the design gives candidates. Public — it is on the page. */
export const RECRUIT_EMAIL = 'recruitment@fastactionclaims.co.uk';

/** The server's slug for this role; also the `role` multipart field. */
export const SALES_SLUG = 'sales';

/** Progress bar labels, in the design's words. */
export const STEP_LABELS = ['Your details', 'About you', 'Assessment', 'Voice note', 'CV & submit'];

/** Form pages in order; each index lines up with STEP_LABELS. */
export const FORM_PAGES = ['details', 'written', 'assessment', 'voice', 'cv'];

export const DEFAULT_LIMITS = {
  cvMaxBytes: 10 * 1024 * 1024,
  voiceMaxBytes: 25 * 1024 * 1024,
  voiceMaxSeconds: 7 * 60,
  voiceMinSeconds: 10,
};

/** The prototype's dropdown lists — used only if the server sends none. */
export const FALLBACK_DETAIL_OPTIONS = {
  qualifications: [
    'Matric / NSC',
    'Higher Certificate',
    'Diploma',
    "Bachelor's degree",
    'Honours / Postgraduate',
    'Other',
  ],
  experience: ['None yet', 'Under 1 year', '1–2 years', '3–5 years', '5+ years'],
  heardFrom: [
    'LinkedIn',
    'Pnet / Careers24',
    'Indeed',
    'Referral from a friend',
    'Facebook',
    'Other',
  ],
  noticePeriods: ['Available immediately', '1 week', '2 weeks', '1 month', 'More than 1 month'],
};

export const EMPTY_DETAILS = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  qualification: '',
  experience: '',
  heardFrom: '',
  noticePeriod: '',
};
