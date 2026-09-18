/**
 * The Sales & Customer Service (South Africa) application: what it asks, and
 * what each answer is worth.
 *
 * SERVER-ONLY, for the same reason as ../questions.js: the option scores are
 * the shortlisting rubric, and a copy in the client bundle is a copy in every
 * candidate's devtools. The form receives these through
 * `GET /api/recruit/roles/sales` with every `score` stripped.
 *
 * Kept apart from the paralegal questions because it is a different job with a
 * different marking scheme: negative weights on the multi-selects, word
 * minimums rather than character minimums, and a details step the other roles
 * do not have. Folding it into the shared file would put an `if (sales)` in
 * front of every reader of that file.
 *
 * Plain data, no imports -- see limits.js for why that matters here.
 */

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/**
 * Written answers. `minWords` is what the form asks for; the server checks
 * only that an answer exists and fits the column (validateWritten), exactly as
 * for the other roles. A word count is a nudge, not a gate: someone who writes
 * 58 honest words should reach a human, not a 400.
 */
export const SALES_WRITTEN_QUESTIONS = freeze([
  {
    id: 'w1',
    label: 'Tell us about yourself and why you want to work in sales and customer service.',
    minWords: 60,
  },
  {
    id: 'w2',
    label:
      'Describe your sales or customer-facing experience so far. Include the products or services you sold, the targets you had, and how you did against them.',
    minWords: 60,
  },
  {
    id: 'w3',
    label: "Tell us about a time you turned a 'no' into a 'yes'. What did you actually say and do?",
    minWords: 50,
  },
  {
    id: 'w4',
    label:
      'How do you handle rejection or a difficult customer without losing your energy for the next call?',
    minWords: 40,
  },
  {
    id: 'w5',
    label:
      'What do you know about Fast Action Claims and the claims we handle (irresponsible lending, gambling harm, car finance)? Why does this kind of work interest you?',
    minWords: 40,
  },
  {
    id: 'w6',
    label:
      "This role is on UK hours (9:00 AM – 6:00 PM UK time, phone-based, working from our South Africa office). Confirm you can commit to this and tell us about your home or office setup, internet reliability and any notice period you'd need.",
    minWords: 30,
  },
]);

/**
 * The assessment. Same shape as ../questions.js, so validateAnswers and
 * publicQuestionsFor work on it unchanged.
 *
 * The negative scores are deliberate. On a multi-select they are what stops
 * "tick everything" from scoring well: promising a payout, or preferring not
 * to cold-call, costs points in a role where either would be a real problem.
 */
export const SALES_QUESTIONS = freeze([
  {
    id: 'q1',
    question:
      "A caller says: 'I've had three of these calls this week. Why should I trust you?' What do you do?",
    options: [
      {
        label:
          "Acknowledge it, explain we're an SRA-regulated law firm with no upfront fees, and ask one open question about their situation before saying anything else.",
        score: 3,
      },
      { label: 'Apologise and offer to remove them from the list.', score: 0 },
      { label: "Tell them the other companies are cowboys and we're the best.", score: 0 },
      { label: 'Go straight into explaining how the claim process works.', score: 1 },
    ],
  },
  {
    id: 'q2',
    question:
      "A client is interested but says 'Let me think about it and call you back.' What's your best next step?",
    options: [
      { label: "Say 'no problem' and end the call.", score: 0 },
      {
        label:
          'Ask what specifically they want to think about, address it, and agree a clear next step with a date and time.',
        score: 3,
      },
      { label: 'Push them to sign today because the offer ends soon.', score: 0 },
      { label: 'Send an email and hope they read it.', score: 1 },
    ],
  },
  {
    id: 'q3',
    question:
      'Which of these must you ALWAYS do on a call with a potential client? Select all that apply.',
    multi: true,
    options: [
      { label: "Confirm you're speaking to the right person before discussing their situation", score: 1 },
      { label: "Be honest about fees, timescales and that results aren't guaranteed", score: 1 },
      { label: 'Promise a payout amount to get them to sign', score: -2 },
      { label: 'Keep accurate notes in the CRM straight after the call', score: 1 },
      { label: "Tell them they'll definitely win if they sign today", score: -2 },
    ],
  },
  {
    id: 'q4',
    question: "You're 30 calls in, no sign-ups, and it's 3pm. What do you do?",
    options: [
      {
        label:
          'Take a short reset, review my last few calls for what I could tweak, then get back on the phone with a target for the next hour.',
        score: 3,
      },
      { label: "Slow down — it's clearly not a good day.", score: 0 },
      { label: 'Start reading the script faster to get through more calls.', score: 1 },
      { label: 'Ask my manager to move me to admin work for the afternoon.', score: 0 },
    ],
  },
  {
    id: 'q5',
    question: 'A caller starts swearing and says the company is a scam. How do you respond?',
    options: [
      {
        label:
          "Stay calm, don't take it personally, let them finish, then say: 'I understand — can I explain exactly who we are and how this works, and you decide?'",
        score: 3,
      },
      { label: 'Hang up immediately.', score: 0 },
      { label: "Match their tone so they know I'm not a pushover.", score: 0 },
      { label: "Say 'okay bye' and mark the lead as dead.", score: 1 },
    ],
  },
  {
    id: 'q6',
    question:
      "A client asks a question about their claim that you don't know the answer to. What do you do?",
    options: [
      { label: "Give my best guess so I don't lose the momentum.", score: 0 },
      {
        label:
          "Say I'll find out from the legal team and confirm a time I'll call back — then actually do it.",
        score: 3,
      },
      { label: 'Tell them to email the office.', score: 1 },
      { label: 'Change the subject back to signing up.', score: 0 },
    ],
  },
  {
    id: 'q7',
    question: 'Which of these best describe you? Select all that apply.',
    multi: true,
    options: [
      { label: "I'm comfortable making 80–120 outbound calls a day", score: 1 },
      { label: 'I track my own numbers (calls, conversations, sign-ups) without being asked', score: 1 },
      { label: 'I prefer to wait for warm leads rather than dial cold', score: -1 },
      { label: 'I like a clear target and a bonus tied to hitting it', score: 1 },
      { label: 'I find it hard to stay motivated when people say no', score: -1 },
    ],
  },
  {
    id: 'q8',
    question:
      "An existing client calls, upset that they haven't heard anything for 3 weeks. How do you handle it?",
    options: [
      {
        label:
          'Apologise, check the CRM for the real status, give them a straight update, and set an expectation for the next contact.',
        score: 3,
      },
      { label: 'Tell them these things take time and to be patient.', score: 1 },
      { label: "Transfer them to someone else — it's not a sales call.", score: 0 },
      { label: 'Tell them their case handler is on holiday.', score: 0 },
    ],
  },
  {
    id: 'q9',
    question: 'How would you open a cold call to someone who may have been mis-sold a loan?',
    options: [
      {
        label:
          "'Hi, is that [name]? It's [me] from Fast Action Claims — a UK law firm. Have I caught you at an okay time? I'll be quick.' Then one question about their lending.",
        score: 3,
      },
      { label: "'Hello, you may be entitled to compensation, are you interested?'", score: 1 },
      { label: "'Hi, this is a courtesy call about money you're owed.'", score: 0 },
      { label: 'Read the full script before pausing.', score: 0 },
    ],
  },
  {
    id: 'q10',
    question:
      "Your manager gives you feedback that your calls are too long and you're over-explaining. How do you react?",
    options: [
      {
        label:
          'Thank them, ask for a specific example, and practise a tighter version on my next ten calls.',
        score: 3,
      },
      { label: 'Explain why my way works better.', score: 0 },
      { label: 'Agree in the moment but carry on as before.', score: 0 },
      { label: 'Feel disheartened for the rest of the day.', score: 1 },
    ],
  },
]);

/**
 * The details step's dropdowns. The server accepts exactly these strings and
 * nothing else, and the form is sent this list rather than keeping its own
 * copy, so the two cannot disagree about what "1–2 years" is spelled with.
 */
export const SALES_DETAIL_OPTIONS = freeze({
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
});
