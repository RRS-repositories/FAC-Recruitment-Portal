import { useState } from 'react';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { shortWrittenMessage, wordCount } from '../helpers';

/**
 * Step 2 — "About you". Questions and word minimums come from the server.
 *
 * The telemetry handlers are the same pair the other roles attach
 * (see features/application/steps/WrittenStep.jsx): `input`, not `keydown`,
 * because a phone keyboard reports no key; paste is counted, never blocked.
 */
export function WrittenStep({ questions, values, onChange, telemetry, serverMessage, onBack, onNext, titleRef }) {
  const [error, setError] = useState('');

  const next = () => {
    const message = shortWrittenMessage(questions, values);
    setError(message);
    if (!message) onNext();
  };

  return (
    <FormShell
      ref={titleRef}
      step={1}
      title="About you"
      sub="Short, honest answers in your own words. Minimum word counts are shown — there's no maximum."
    >
      {questions.map((q, i) => {
        const id = `sales-${q.id}`;
        return (
          <div key={q.id}>
            <label className="f" htmlFor={id}>
              {i + 1}. {q.label}
              {q.minWords ? <small> (min {q.minWords} words)</small> : null}
            </label>
            <textarea
              id={id}
              className="in"
              value={values[q.id] ?? ''}
              onChange={(e) => onChange({ ...values, [q.id]: e.target.value })}
              onPaste={telemetry.onPaste}
              onInput={telemetry.onInput}
              aria-describedby={`${id}-wc`}
            />
            <div className="wc" id={`${id}-wc`}>
              {wordCount(values[q.id])} words
            </div>
          </div>
        );
      })}

      <ErrorLine message={error || serverMessage} />
      <StepRow onBack={onBack}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={next}>
          Continue to assessment
        </button>
      </StepRow>
    </FormShell>
  );
}

export default WrittenStep;
