/**
 * Assessment content.
 *
 * Option weights live here alongside the questions because the scoring rule in
 * `lib/scoring.js` reads them directly — one place to edit, no lookup table to
 * keep in step. In production these come from `GET /api/recruit/roles/:role`
 * so copy can change without a deploy; the shape is identical.
 */

/** Free-text questions, asked of both roles. */
export const WRITTEN_QUESTIONS = [
  {
    id: 'w1',
    label: "Why do you believe you're the ideal candidate for this role?",
    hint: 'What sets you apart? Think about your strengths, mindset, and what you would bring to the team.',
    minChars: 120,
  },
  {
    id: 'w2',
    label: 'What experience or skills have you gained that make you a strong fit for a paralegal position?',
    hint: 'Legal work, internships, academic projects, or transferable skills from another field.',
    minChars: 120,
  },
  {
    id: 'w3',
    label: 'Where do you see your legal career in two years, and how does this role help you get there?',
    hint: 'We want to understand your ambition and whether this role fits your plans.',
    minChars: 120,
  },
];

/** Scenario questions shared by both roles. */
export const SHARED_QUESTIONS = [
  {
    id: 's1',
    question:
      "A UK-based client emails you frustrated because they haven't heard about their claim in two weeks. What do you do?",
    options: [
      { label: 'Check the case file immediately, draft a clear update with next steps, and respond within the hour', score: 3 },
      { label: 'Forward the email to your UK manager and let them deal with it', score: 1 },
      { label: 'Reply saying these things take time and someone from the UK team will be in touch', score: 1 },
      { label: 'Wait until there is an actual update before replying', score: 0 },
    ],
  },
  {
    id: 's2',
    question: 'You spot what looks like an error in a document a senior colleague prepared. What do you do?',
    options: [
      { label: 'Raise it privately with them, showing what you found and why you think it is wrong', score: 3 },
      { label: 'Fix it quietly yourself and say nothing', score: 1 },
      { label: 'Mention it to your manager rather than the colleague', score: 2 },
      { label: 'Leave it — they are more senior and probably right', score: 0 },
    ],
  },
  {
    id: 's3',
    question: 'How comfortable are you working to UK deadlines and time zones?',
    options: [
      { label: 'Very — I have worked UK hours before and it suits me', score: 3 },
      { label: 'Comfortable — I understand the hours and am ready for them', score: 2 },
      { label: 'I would need some time to adjust but I am willing', score: 1 },
      { label: 'I would prefer local hours', score: 0 },
    ],
  },
  {
    id: 's4',
    question: 'Which of these tools have you used? (select all that apply)',
    multi: true,
    options: [
      { label: 'Case management or CRM software', score: 3 },
      { label: 'Microsoft Word and Excel to a confident standard', score: 2 },
      { label: 'Legal research databases', score: 3 },
      { label: 'Google Workspace', score: 1 },
      { label: 'None of these yet', score: 0 },
    ],
  },
  {
    id: 's5',
    question: 'You have three tasks due today and cannot finish all of them. What do you do?',
    options: [
      { label: 'Flag it early to your manager with a proposed order of priority', score: 3 },
      { label: 'Work late and try to finish everything', score: 2 },
      { label: 'Complete what you can and explain at the end of the day', score: 1 },
      { label: 'Start with whichever is easiest', score: 0 },
    ],
  },
];
