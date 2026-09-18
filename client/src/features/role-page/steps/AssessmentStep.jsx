import { useState } from 'react';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { useRoleConfig } from '../RoleContext';
import { missingAnswersMessage } from '../helpers';

/**
 * The scenario assessment.
 *
 * The questions arrive from the server with every score stripped; the
 * browser only records which option index was picked (an array for a
 * "select all" question), the shape the server scores.
 *
 * Options are real <button>s with aria-pressed — the designs' divs could not
 * be reached by keyboard — styled exactly as their `.opt` cards.
 */
export function AssessmentStep({
  step,
  questions,
  values,
  onChange,
  serverMessage,
  onBack,
  onNext,
  titleRef,
}) {
  const { idPrefix, copy } = useRoleConfig();
  const [error, setError] = useState('');

  const pick = (q, j) => {
    if (!q.multi) {
      onChange({ ...values, [q.id]: j });
      return;
    }
    const current = Array.isArray(values[q.id]) ? values[q.id] : [];
    onChange({
      ...values,
      [q.id]: current.includes(j) ? current.filter((x) => x !== j) : [...current, j],
    });
  };

  const isSelected = (q, j) =>
    q.multi ? Array.isArray(values[q.id]) && values[q.id].includes(j) : values[q.id] === j;

  const next = () => {
    const message = missingAnswersMessage(questions, values);
    setError(message);
    if (!message) onNext();
  };

  return (
    <FormShell
      ref={titleRef}
      step={step}
      title={copy.assessmentTitle}
      sub={copy.assessmentSub(questions.length)}
    >
      {questions.map((q, i) => (
        <div className="q" key={q.id} role="group" aria-labelledby={`${idPrefix}-${q.id}-t`}>
          <div className="n">
            Question {i + 1} of {questions.length}
            {q.multi ? ' · select all that apply' : ''}
          </div>
          <div className="t" id={`${idPrefix}-${q.id}-t`}>
            {q.question}
          </div>
          {q.options.map((o, j) => {
            const selected = isSelected(q, j);
            return (
              <button
                type="button"
                key={j}
                className={`opt ${q.multi ? '' : 'r'} ${selected ? 'sel' : ''}`}
                aria-pressed={selected}
                onClick={() => pick(q, j)}
              >
                <i aria-hidden="true" />
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      ))}

      <ErrorLine message={error || serverMessage} />
      <StepRow onBack={onBack}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={next}>
          {copy.assessmentNext}
        </button>
      </StepRow>
    </FormShell>
  );
}

export default AssessmentStep;
