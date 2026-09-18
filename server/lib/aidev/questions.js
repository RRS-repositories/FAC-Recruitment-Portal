/**
 * The AI Developer (India, remote) application: what it asks, and what each
 * answer is worth.
 *
 * SERVER-ONLY, for the same reason as ../questions.js: the option scores are
 * the shortlisting rubric, and a copy in the client bundle is a copy in every
 * candidate's devtools. The form receives these through
 * `GET /api/recruit/roles/ai-developer` with every `score` stripped.
 *
 * Taken from the role's design (the prototype's WRITTEN, QUESTIONS and details
 * lists), with its `type: "single" | "multi"` turned into this codebase's
 * `multi: true` and its `s` into `score`. Marked by ../weightedScore.js, the
 * same rule as the sales role: negative weights on a multi-select cost points.
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
 * for the other roles. A word count is a nudge, not a gate.
 */
export const AIDEV_WRITTEN_QUESTIONS = freeze([
  {
    id: 'w1',
    label:
      "Tell us about yourself and what you've actually built. Not your CV — the two or three things you're proudest of and what they do.",
    minWords: 60,
  },
  {
    id: 'w2',
    label:
      "Describe a CRM or business system you've worked on. What did it store, who used it, and what did you build or change in it?",
    minWords: 60,
  },
  {
    id: 'w3',
    label:
      "Describe an automation you've built end to end (n8n, Make, Zapier, custom code — anything). What triggered it, what did it do, and what broke?",
    minWords: 60,
  },
  {
    id: 'w4',
    label:
      "Describe something you've built with an LLM or AI agent (OpenAI, Claude, Gemini, open-source). How did you handle prompts, tool calls, errors and cost?",
    minWords: 50,
  },
  {
    id: 'w5',
    label:
      "Tell us about a production bug that was hard to find. How did you track it down and what did you change so it couldn't happen again?",
    minWords: 50,
  },
  {
    id: 'w6',
    label:
      "We're building a large AI-driven CRM and automation platform for a UK law firm. What questions would you ask us in the first week, and what would you want to look at in the codebase first?",
    minWords: 50,
  },
  {
    id: 'w7',
    label:
      "This role is fully remote on UK hours (9:00 AM – 6:00 PM UK time) and you'll report to our UK head of development. Confirm you can commit to this, and tell us about your home setup, internet reliability and notice period.",
    minWords: 25,
  },
]);

/**
 * The assessment. Same shape as ../questions.js, so validateAnswers and
 * publicQuestionsFor work on it unchanged.
 *
 * q3's negative options are what stops "tick everything" scoring well. q8 has
 * none: every option is a thing somebody has used, worth a point, and the
 * question tells them it will be asked about at interview.
 */
export const AIDEV_QUESTIONS = freeze([
  {
    id: 'q1',
    question:
      'An n8n workflow that sends WhatsApp reminders to clients has started firing twice for some records. What do you check first?',
    options: [
      {
        label:
          "Whether the trigger is polling and the dedupe key / 'last processed' state is being written correctly, and whether two workflow instances are running.",
        score: 3,
      },
      { label: 'Add a 5-second delay node before the send step.', score: 0 },
      { label: 'Ask clients to ignore the duplicates for now.', score: 0 },
      { label: 'Restart the n8n container.', score: 1 },
    ],
  },
  {
    id: 'q2',
    question:
      'You need to pull 40,000 client records from a CRM API that allows 100 records per call and 60 calls per minute. How do you build it?',
    options: [
      {
        label:
          'Paginate with a cursor, throttle to stay under the limit, retry with backoff on 429/5xx, checkpoint progress so it can resume, and log each page.',
        score: 3,
      },
      { label: 'Loop until it finishes and increase the rate limit by asking the vendor.', score: 1 },
      { label: 'Fire all requests in parallel — the API will queue them.', score: 0 },
      { label: 'Export manually from the CRM UI once and import the file.', score: 0 },
    ],
  },
  {
    id: 'q3',
    question:
      'An AI agent classifies incoming emails and drafts replies. Which of these should be in the design? Select all that apply.',
    multi: true,
    options: [
      { label: 'Structured output (JSON schema) validated before anything acts on it', score: 1 },
      { label: 'A confidence threshold below which a human reviews the draft', score: 1 },
      { label: "Let the model send replies directly with no review — it's faster", score: -2 },
      { label: 'Logging every prompt, response, token count and cost per email', score: 1 },
      { label: 'Put client personal data into the prompt with no thought about retention', score: -2 },
    ],
  },
  {
    id: 'q4',
    question: 'A webhook from a payment provider hits your endpoint. What must the endpoint do?',
    options: [
      {
        label:
          'Verify the signature, respond 200 quickly, then process the event idempotently by event ID on a queue.',
        score: 3,
      },
      { label: 'Process everything inline, then return 200 when done.', score: 1 },
      { label: "Trust the payload — it came from the provider's IP.", score: 0 },
      { label: 'Store the raw body and process it manually later.', score: 0 },
    ],
  },
  {
    id: 'q5',
    question:
      "A Postgres query behind a CRM dashboard has gone from 200ms to 9 seconds as data grew. What's your first move?",
    options: [
      {
        label:
          'EXPLAIN ANALYZE it, look for sequential scans and missing indexes on the filter/join columns, and check if a bad plan is caused by stale stats.',
        score: 3,
      },
      { label: 'Add caching in front of it.', score: 1 },
      { label: 'Increase the database server size.', score: 1 },
      { label: 'Rewrite the dashboard in a different framework.', score: 0 },
    ],
  },
  {
    id: 'q6',
    question:
      "You're given a repo with no README, no tests and a Docker Compose file. You need to add a feature. What do you do first?",
    options: [
      {
        label:
          'Get it running locally from the Compose file, map the main entry points and data model, and write a short note of what I found before touching anything.',
        score: 3,
      },
      { label: "Start coding the feature — I'll learn the codebase as I go.", score: 1 },
      { label: 'Rewrite it properly with tests first.', score: 0 },
      { label: 'Ask for a full handover document before I start.', score: 0 },
    ],
  },
  {
    id: 'q7',
    question:
      "An LLM call in production sometimes returns text that isn't valid JSON and crashes the workflow. Best fix?",
    options: [
      {
        label:
          "Use the provider's structured-output / tool-call mode, validate against a schema, and on failure retry once with the error fed back before falling to a human queue.",
        score: 3,
      },
      { label: 'Wrap it in try/catch and skip the record.', score: 1 },
      { label: "Add 'Respond only in JSON' to the prompt in capital letters.", score: 1 },
      { label: 'Switch to a bigger model.', score: 0 },
    ],
  },
  {
    id: 'q8',
    question:
      "Which of these have you personally used in a real project (not a tutorial)? Be honest — we'll ask about it at interview. Select all that apply.",
    multi: true,
    options: [
      { label: 'n8n / Make / Zapier', score: 1 },
      { label: 'Node.js or Python backend with a REST API', score: 1 },
      { label: 'Postgres / MySQL schema design', score: 1 },
      { label: 'OpenAI / Anthropic / Gemini API in production', score: 1 },
      { label: 'Docker and a Linux VPS', score: 1 },
      { label: 'Git with branches, PRs and code review', score: 1 },
      { label: 'Twilio / WhatsApp Business API / email APIs', score: 1 },
      { label: 'React or similar front-end', score: 1 },
    ],
  },
  {
    id: 'q9',
    question: "A staff member reports 'the CRM is slow' at 3pm every day. How do you approach it?",
    options: [
      {
        label:
          'Check what runs at 3pm (cron, reports, backups), look at server metrics and slow-query logs for that window, reproduce, then fix the root cause.',
        score: 3,
      },
      { label: 'Tell them to clear their browser cache.', score: 0 },
      { label: 'Restart the server every day at 2:55.', score: 0 },
      { label: 'Add more RAM and see if it helps.', score: 1 },
    ],
  },
  {
    id: 'q10',
    question:
      'Your head of development asks you to use Claude Code / an AI coding agent to speed up delivery. Your view?',
    options: [
      {
        label:
          "Great — I'll use it for scaffolding, tests and refactors, but I review every diff, keep it on a branch, and I'm accountable for what ships.",
        score: 3,
      },
      { label: "I'd rather write everything myself; AI code can't be trusted.", score: 1 },
      { label: 'Let it push straight to main to save time.', score: 0 },
      { label: "I've never used one so I'd need training first.", score: 1 },
    ],
  },
  {
    id: 'q11',
    question:
      'You discover client data is being logged in plain text in a debug log on the server. What do you do?',
    options: [
      {
        label:
          'Stop the logging immediately, purge the existing logs, tell the head of development the same day, and add redaction so it can\'t recur.',
        score: 3,
      },
      { label: 'Leave it — logs are internal.', score: 0 },
      { label: 'Mention it in the next sprint review.', score: 1 },
      { label: 'Encrypt the log file.', score: 1 },
    ],
  },
  {
    id: 'q12',
    question:
      "You're 60% through a task and realise the approach you agreed with your manager won't work. What do you do?",
    options: [
      {
        label:
          "Flag it now with what I've found and two options, rather than finishing the wrong thing or silently switching approach.",
        score: 3,
      },
      { label: "Finish it as agreed — it's what was asked.", score: 0 },
      { label: 'Quietly switch to a better approach and explain later.', score: 1 },
      { label: 'Stop and wait for the next scheduled meeting.', score: 0 },
    ],
  },
]);

/**
 * The details step's dropdowns, from the design's QUALS / EXPS / SRCS /
 * NOTICE without their blank placeholder. The server accepts exactly these
 * strings and nothing else, and the form is sent this list rather than keeping
 * its own copy, so the two cannot disagree about how "1–2 years" is spelled.
 */
export const AIDEV_DETAIL_OPTIONS = freeze({
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
});
