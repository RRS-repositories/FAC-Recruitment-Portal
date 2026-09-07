/**
 * The assessment, with its marking scheme.
 *
 * THIS FILE IS SERVER-ONLY AND MUST STAY THAT WAY.
 *
 * The option weights are the shortlisting rubric. They were previously bundled
 * into the client, which put `score: 3` next to every answer in the JavaScript
 * every visitor downloads — a candidate with devtools open could read exactly
 * which option to pick. Making the repository private would not have fixed
 * that, because the leak was in the built bundle, not the source.
 *
 * `GET /api/recruit/roles/:role` therefore serves these questions with the
 * scores stripped. The client renders labels; the server alone knows what they
 * are worth.
 *
 * In a later stage this moves into the database so wording can change without
 * a deploy (build spec §4). The shape is the same either way.
 */

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

/** Scenario questions asked of both roles. */
const SHARED_QUESTIONS = [
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

const ROLE_QUESTIONS = {
  india_intern: [
    {
      id: 'q1',
      question: 'Which of the following best describes your current situation?',
      options: [
        { label: 'Currently working in a legal or paralegal role', score: 3 },
        { label: 'Final-year law student or recently graduated', score: 2 },
        { label: 'Have previous legal experience but currently in a different field', score: 2 },
        { label: 'No legal background but keen to start a career in law', score: 1 },
      ],
    },
    {
      id: 'q2',
      question: 'What qualifications do you hold?',
      multi: true,
      options: [
        { label: 'BA LLB / BBA LLB (5-year integrated) or 3-year LLB', score: 3 },
        { label: 'LLM completed or in progress', score: 3 },
        { label: 'Pursuing or completed CS / CA / Company Secretary', score: 2 },
        { label: 'Other undergraduate degree (non-law)', score: 1 },
        { label: '12th pass / currently in final year of degree', score: 1 },
      ],
    },
    ...SHARED_QUESTIONS,
    {
      id: 'q11',
      question: 'What interests you most about this role at Fast Action Claims?',
      options: [
        { label: 'Gaining hands-on experience in UK consumer law while working from India', score: 3 },
        { label: 'The opportunity to grow with an international legal firm and earn a full-time contract', score: 3 },
        { label: 'Building a career in the legal sector with real casework from day one', score: 2 },
        { label: 'I just need any internship right now', score: 0 },
      ],
    },
  ],

  sa_paralegal: [
    {
      id: 'q1',
      question: 'Which of the following best describes your current situation?',
      options: [
        { label: 'Working as a paralegal or legal secretary now', score: 3 },
        { label: 'Admitted attorney or completed articles', score: 3 },
        { label: 'LLB graduate seeking a first legal role', score: 2 },
        { label: 'Working in another field, moving into law', score: 1 },
      ],
    },
    {
      id: 'q2',
      question: 'What qualifications do you hold?',
      multi: true,
      options: [
        { label: 'LLB', score: 3 },
        { label: 'Paralegal diploma or certificate', score: 2 },
        { label: 'BCom Law / BA Law', score: 2 },
        { label: 'Matric only', score: 1 },
      ],
    },
    ...SHARED_QUESTIONS,
    {
      id: 'q11',
      question: 'What interests you most about this role at Fast Action Claims?',
      options: [
        { label: 'Working on UK consumer law matters with a growing firm', score: 3 },
        { label: 'A stable full-time remote position with real casework', score: 3 },
        { label: 'Building specialist experience I cannot get locally', score: 2 },
        { label: 'I am applying widely at the moment', score: 0 },
      ],
    },
  ],
};

/** Full questions, weights included. Server use only. */
export function questionsFor(apiKey) {
  return ROLE_QUESTIONS[apiKey] ?? null;
}

/**
 * The same questions with every `score` removed — this is what goes over the
 * wire. Built fresh each call so a caller cannot mutate the source.
 */
export function publicQuestionsFor(apiKey) {
  const questions = ROLE_QUESTIONS[apiKey];
  if (!questions) return null;

  return questions.map(({ id, question, multi, options }) => ({
    id,
    question,
    ...(multi ? { multi: true } : {}),
    options: options.map(({ label }) => ({ label })),
  }));
}
