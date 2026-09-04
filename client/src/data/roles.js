import { SHARED_QUESTIONS, WRITTEN_QUESTIONS } from './questions';

/**
 * The two open roles.
 *
 * Copy and questions are held as data rather than baked into components, so a
 * third role is a new entry here plus a route — no component changes. This
 * mirrors the shape of `GET /api/recruit/roles/:role`, which replaces this
 * file when the API lands.
 */

const ROLE_SPECIFIC = {
  india: [
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
  ],
  'south-africa': [
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
  ],
};

const CLOSING_QUESTION = {
  india: {
    id: 'q11',
    question: 'What interests you most about this role at Fast Action Claims?',
    options: [
      { label: 'Gaining hands-on experience in UK consumer law while working from India', score: 3 },
      { label: 'The opportunity to grow with an international legal firm and earn a full-time contract', score: 3 },
      { label: 'Building a career in the legal sector with real casework from day one', score: 2 },
      { label: 'I just need any internship right now', score: 0 },
    ],
  },
  'south-africa': {
    id: 'q11',
    question: 'What interests you most about this role at Fast Action Claims?',
    options: [
      { label: 'Working on UK consumer law matters with a growing firm', score: 3 },
      { label: 'A stable full-time remote position with real casework', score: 3 },
      { label: 'Building specialist experience I cannot get locally', score: 2 },
      { label: 'I am applying widely at the moment', score: 0 },
    ],
  },
};

export const ROLES = {
  india: {
    key: 'india',
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
      { value: '£4m+', label: 'Recovered for clients' },
      { value: '7 days', label: 'Average time to interview' },
      { value: '100%', label: 'Remote' },
    ],
    questions: [...ROLE_SPECIFIC.india, ...SHARED_QUESTIONS, CLOSING_QUESTION.india],
  },

  'south-africa': {
    key: 'south-africa',
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
      { value: '£4m+', label: 'Recovered for clients' },
      { value: '7 days', label: 'Average time to interview' },
      { value: '100%', label: 'Remote' },
    ],
    questions: [...ROLE_SPECIFIC['south-africa'], ...SHARED_QUESTIONS, CLOSING_QUESTION['south-africa']],
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export const getRole = (key) => ROLES[key] ?? null;

export { WRITTEN_QUESTIONS };
