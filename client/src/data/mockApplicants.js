/**
 * Mock applicants for the dashboard, until the API lands.
 *
 * Invented names and addresses only — never a real candidate — per the data
 * hygiene rules. The mix is deliberate rather than random: it covers every
 * state a manager has to be able to deal with, so the UI is exercised properly
 * instead of just looking full.
 *
 *   · a strong candidate already booked
 *   · one already interviewed and attended
 *   · a no-show
 *   · one flagged as AI-used, with the reasons that triggered it
 *   · one flagged "possible", which is the ambiguous case a manager must judge
 *   · a suspiciously fast submission
 *   · a declined application
 *   · a weak-but-clean application, so "low score" and "AI flag" stay visibly
 *     separate concerns
 */

const daysAgo = (n, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

const daysAhead = (n, hour = 14) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_APPLICANTS = [
  {
    id: 'a1',
    role: 'india',
    fullName: 'Ananya Rao',
    email: 'ananya.rao@example.com',
    phone: '+91 98200 11223',
    createdAt: daysAgo(1, 9),
    score: 92,
    status: 'accepted',
    interviewStatus: 'booked',
    interviewAt: daysAhead(2, 14),
    durationSec: 742,
    ai: { level: 'clean', score: 5, reasons: [] },
    written: {
      w1: 'I have spent the last eighteen months as a legal assistant at a small firm in Pune, handling consumer complaints end to end. I am the person clients call when they are frustrated, and I have learned that most of the job is being clear about what happens next.',
      w2: 'I completed my BA LLB in 2024 and worked on consumer disputes throughout. I draft particulars of claim, manage case files and handle client calls daily.',
      w3: 'In two years I want to be running my own caseload of UK consumer claims. This role gives me direct exposure to UK law, which I cannot get locally.',
    },
    answers: { q1: 0, q2: [0, 1], s1: 0, s2: 0, s3: 0, s4: [0, 1, 2], s5: 0, q11: 0 },
  },
  {
    id: 'a2',
    role: 'south-africa',
    fullName: 'Thandiwe Mokoena',
    email: 'thandiwe.m@example.com',
    phone: '+27 82 555 0144',
    createdAt: daysAgo(3, 11),
    score: 88,
    status: 'accepted',
    interviewStatus: 'attended',
    interviewAt: daysAgo(1, 13),
    durationSec: 913,
    ai: { level: 'clean', score: 10, reasons: [] },
    written: {
      w1: 'I am a qualified paralegal with four years at a Johannesburg firm, mostly debt review and consumer credit matters. I am used to holding a caseload and to clients who are worried about money.',
      w2: 'LLB from Wits, then articles at a mid-size firm. Strong drafting, and I have run client care for a book of about ninety files.',
      w3: 'I want to specialise in consumer claims work properly. Two years from now I would want to be senior in the SA team.',
    },
    answers: { q1: 0, q2: [0], s1: 0, s2: 0, s3: 0, s4: [0, 1, 2], s5: 0, q11: 0 },
  },
  {
    id: 'a3',
    role: 'india',
    fullName: 'Rohit Malhotra',
    email: 'rohit.malhotra@example.com',
    phone: '+91 99100 44556',
    createdAt: daysAgo(1, 14),
    score: 78,
    status: 'pending',
    interviewStatus: 'not_invited',
    interviewAt: null,
    durationSec: 168,
    // Flagged: pasted text plus implausible typing speed. Both behavioural,
    // which is the layer the spec weights highest.
    ai: {
      level: 'ai_used',
      score: 85,
      reasons: [
        'Pasted 612 characters into answer boxes',
        'Typing speed 14.2 characters/sec sustained',
        'AI-style phrasing: "in today\'s fast-paced", "leverage my", "a testament to"',
        '4 em dashes',
      ],
    },
    written: {
      w1: "In today's fast-paced legal environment, I am confident that I can leverage my academic background to deliver exceptional value — a testament to my dedication.",
      w2: 'My meticulous attention to detail and robust understanding of legal principles underscores my suitability for this pivotal role.',
      w3: 'I aim to seamlessly navigate the complexities of UK consumer law and play a pivotal role in the firm.',
    },
    answers: { q1: 1, q2: [0], s1: 0, s2: 2, s3: 1, s4: [1, 3], s5: 0, q11: 1 },
  },
  {
    id: 'a4',
    role: 'south-africa',
    fullName: 'Pieter van Wyk',
    email: 'p.vanwyk@example.com',
    phone: '+27 83 555 0199',
    createdAt: daysAgo(2, 16),
    score: 71,
    status: 'pending',
    interviewStatus: 'not_invited',
    interviewAt: null,
    durationSec: 486,
    // The ambiguous middle. Two soft signals and nothing conclusive — exactly
    // the case where a manager must read the answers and decide.
    ai: {
      level: 'possible',
      score: 40,
      reasons: ['Pasted 96 characters into answer boxes', 'Left the page 5 times while writing'],
    },
    written: {
      w1: 'I have worked in legal support for three years and I enjoy the detail of case preparation. I am reliable and I meet deadlines.',
      w2: 'BCom Law, then paralegal work at two firms. Comfortable with drafting and with client contact.',
      w3: 'I would like to move into a specialist consumer claims role and build depth rather than breadth.',
    },
    answers: { q1: 2, q2: [2], s1: 0, s2: 0, s3: 1, s4: [1, 3], s5: 1, q11: 1 },
  },
  {
    id: 'a5',
    role: 'india',
    fullName: 'Sneha Iyer',
    email: 'sneha.iyer@example.com',
    phone: '+91 90040 77881',
    createdAt: daysAgo(4, 10),
    score: 84,
    status: 'accepted',
    interviewStatus: 'no_show',
    interviewAt: daysAgo(1, 15),
    durationSec: 656,
    ai: { level: 'clean', score: 0, reasons: [] },
    written: {
      w1: 'I am a final-year law student at NLU and I have interned twice in consumer disputes. I want real casework rather than research tasks.',
      w2: 'Two internships, both in litigation support. I have drafted notices and sat in on client meetings.',
      w3: 'Qualified and handling my own files. This role would give me two years of practical UK work first.',
    },
    answers: { q1: 1, q2: [0, 4], s1: 0, s2: 0, s3: 0, s4: [1, 2, 3], s5: 0, q11: 2 },
  },
  {
    id: 'a6',
    role: 'india',
    fullName: 'Vikram Desai',
    email: 'v.desai@example.com',
    phone: '+91 91700 22334',
    createdAt: daysAgo(5, 12),
    score: 34,
    status: 'declined',
    interviewStatus: 'not_invited',
    interviewAt: null,
    durationSec: 121,
    // Low score, clean detection — proves the two are independent signals.
    ai: { level: 'clean', score: 0, reasons: [] },
    written: {
      w1: 'I need a job and I can learn.',
      w2: 'I have done a computer course and some office work.',
      w3: 'Not sure yet, maybe law.',
    },
    answers: { q1: 3, q2: [4], s1: 3, s2: 3, s3: 3, s4: [4], s5: 3, q11: 3 },
  },
  {
    id: 'a7',
    role: 'south-africa',
    fullName: 'Lerato Dlamini',
    email: 'lerato.d@example.com',
    phone: '+27 84 555 0177',
    createdAt: daysAgo(0, 8),
    score: 81,
    status: 'pending',
    interviewStatus: 'not_invited',
    interviewAt: null,
    // Under four minutes — flagged amber on time, though nothing else trips.
    durationSec: 194,
    ai: { level: 'clean', score: 15, reasons: [] },
    written: {
      w1: 'I am a paralegal with two years in consumer credit. I work quickly and I like being the person who keeps a file moving.',
      w2: 'LLB, then a paralegal diploma. I have run client onboarding and handled the first stages of claims.',
      w3: 'Senior paralegal or team lead. I want to learn UK consumer law properly.',
    },
    answers: { q1: 0, q2: [0, 1], s1: 0, s2: 2, s3: 0, s4: [0, 2], s5: 0, q11: 0 },
  },
  {
    id: 'a8',
    role: 'south-africa',
    fullName: 'Nomsa Khumalo',
    email: 'nomsa.k@example.com',
    phone: '+27 81 555 0122',
    createdAt: daysAgo(6, 15),
    score: 66,
    status: 'accepted',
    interviewStatus: 'invited',
    interviewAt: null,
    durationSec: 534,
    ai: { level: 'clean', score: 5, reasons: [] },
    written: {
      w1: 'I have five years of administrative experience in a law firm and I am studying towards my LLB part time.',
      w2: 'Strong administration, file management, and I have started drafting basic correspondence under supervision.',
      w3: 'Qualified paralegal, working on live matters rather than supporting them.',
    },
    answers: { q1: 3, q2: [1, 3], s1: 0, s2: 1, s3: 1, s4: [1, 3], s5: 0, q11: 2 },
  },
];

/** Counts for the dashboard's summary row. */
export function summarise(applicants) {
  return {
    total: applicants.length,
    pending: applicants.filter((a) => a.status === 'pending').length,
    accepted: applicants.filter((a) => a.status === 'accepted').length,
    declined: applicants.filter((a) => a.status === 'declined').length,
    booked: applicants.filter((a) => a.interviewStatus === 'booked').length,
    noShows: applicants.filter((a) => a.interviewStatus === 'no_show').length,
    aiFlagged: applicants.filter((a) => a.ai.level !== 'clean').length,
  };
}
