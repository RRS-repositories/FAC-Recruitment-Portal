import { OptionCard } from '@/components/ui/OptionCard';
import { unanswered } from '@/lib/scoring';
import { StepHeader } from '../StepHeader';
import { StepNav } from '../StepNav';

/**
 * Step 3 — the multiple-choice assessment.
 *
 * Scores are never shown to the candidate. They are the firm's shortlisting
 * signal, and displaying them would turn the questions into a game rather than
 * an honest answer.
 *
 * Each question is a fieldset with a legend, so a screen reader announces the
 * question before its options rather than reading eight unlabelled buttons.
 */
export function AssessmentStep({ role, answers, onChange, onBack, onNext }) {
  const remaining = unanswered(role.questions, answers);

  const choose = (question, index) => {
    if (question.multi) {
      const current = Array.isArray(answers[question.id]) ? answers[question.id] : [];
      const next = current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index];
      onChange({ ...answers, [question.id]: next });
    } else {
      onChange({ ...answers, [question.id]: index });
    }
  };

  const isSelected = (question, index) =>
    question.multi
      ? Array.isArray(answers[question.id]) && answers[question.id].includes(index)
      : answers[question.id] === index;

  return (
    <>
      <StepHeader
        eyebrow="Assessment"
        title="A few questions about how you work"
        sub="Answer honestly — we're checking fit, not testing legal knowledge."
        role={role}
      />

      <div className="grid gap-8">
        {role.questions.map((question, qIndex) => (
          <fieldset key={question.id} className="border-0 p-0">
            <legend className="mb-3 block text-[0.95rem] font-semibold leading-snug text-ink">
              <span className="mr-2 text-violet-deep tabular">{qIndex + 1}.</span>
              {question.question}
              {question.multi ? (
                <span className="ml-2 text-[0.78rem] font-normal text-muted">
                  select all that apply
                </span>
              ) : null}
            </legend>

            <div className="grid gap-2.5">
              {question.options.map((option, index) => (
                <OptionCard
                  key={option.label}
                  multi={question.multi}
                  selected={isSelected(question, index)}
                  onSelect={() => choose(question, index)}
                >
                  {option.label}
                </OptionCard>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        disabled={remaining > 0}
        hint={`${remaining} question${remaining === 1 ? '' : 's'} still to answer.`}
      />
    </>
  );
}

export default AssessmentStep;
