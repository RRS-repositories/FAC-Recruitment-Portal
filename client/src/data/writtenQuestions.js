/**
 * The three free-text questions.
 *
 * Safe to ship to the browser: unlike the multiple-choice questions these
 * carry no marks — there is nothing here a candidate could use to work out
 * what scores well. The form needs the labels to render, so keeping them
 * client-side avoids a round trip for no benefit.
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

export default WRITTEN_QUESTIONS;
