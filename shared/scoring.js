/**
 * Assessment scoring.
 *
 * Mirrors the rule in build spec §4 exactly: each question's best option sets
 * the maximum; a multi-select adds every ticked option's score AND raises the
 * denominator per extra tick, so ticking everything does not game the result.
 *
 * The server recomputes this from the same rule and stores its own answer —
 * the client's number is for display only and is never trusted. Keeping the
 * implementation in one importable place is what stops the two drifting.
 */
export function scoreApplication(questions, answers) {
  let total = 0;
  let max = 0;

  for (const question of questions) {
    const best = Math.max(...question.options.map((o) => o.score));
    max += best;

    const answer = answers?.[question.id];
    if (answer === undefined || answer === null) continue;

    if (question.multi && Array.isArray(answer)) {
      for (const index of answer) {
        if (question.options[index]) total += question.options[index].score;
      }
      // Each extra tick raises the ceiling, so selecting everything cannot
      // score higher than selecting the right things.
      max += Math.max(0, answer.length - 1) * best;
    } else if (question.options[answer]) {
      total += question.options[answer].score;
    }
  }

  return max > 0 ? Math.round((total / max) * 100) : 0;
}

/** Bands used by the dashboard and the candidate-facing summary. */
export function gradeFor(score) {
  if (score >= 80) return { label: 'Excellent', tone: 'ok' };
  if (score >= 60) return { label: 'Good', tone: 'violet' };
  if (score >= 40) return { label: 'Fair', tone: 'warn' };
  return { label: 'Weak', tone: 'danger' };
}

/** How many questions still have no answer — drives the step's continue button. */
export function unanswered(questions, answers) {
  return questions.filter((q) => {
    const a = answers?.[q.id];
    if (a === undefined || a === null) return true;
    if (q.multi) return !Array.isArray(a) || a.length === 0;
    return false;
  }).length;
}
