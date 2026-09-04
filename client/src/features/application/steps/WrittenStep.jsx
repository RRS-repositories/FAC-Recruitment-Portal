import { Field, TextArea } from '@/components/ui/Field';
import { WRITTEN_QUESTIONS } from '@/data/roles';
import { StepHeader } from '../StepHeader';
import { StepNav } from '../StepNav';
import { cn } from '@/lib/cn';

export function writtenComplete(answers) {
  return WRITTEN_QUESTIONS.every((q) => (answers[q.id]?.trim().length ?? 0) >= q.minChars);
}

/**
 * Step 2 — the written answers.
 *
 * This is where telemetry matters most, so paste and keystroke handlers are
 * attached to each textarea. They only ever increment counters; nothing is
 * blocked and nothing about the candidate is captured.
 *
 * The character counter is guidance, not a gate that fires on every keystroke:
 * it turns green on reaching the minimum rather than showing an error while
 * someone is still typing their first sentence.
 */
export function WrittenStep({ role, answers, onChange, onBack, onNext, telemetry }) {
  const set = (id) => (event) => onChange({ ...answers, [id]: event.target.value });
  const complete = writtenComplete(answers);

  return (
    <>
      <StepHeader
        eyebrow="In your own words"
        title="Tell us about you"
        sub="Three short answers. There are no right answers here — we're looking for how you think, not perfect prose."
        role={role}
      />

      <div className="grid gap-7">
        {WRITTEN_QUESTIONS.map((question) => {
          const value = answers[question.id] ?? '';
          const count = value.trim().length;
          const enough = count >= question.minChars;

          return (
            <Field key={question.id} label={question.label} hint={question.hint} required>
              {(props) => (
                <>
                  <TextArea
                    {...props}
                    value={value}
                    onChange={set(question.id)}
                    onPaste={telemetry.onPaste}
                    onKeyDown={telemetry.onKeyDown}
                    placeholder="Take your time — a few sentences is plenty."
                  />
                  <p
                    className={cn(
                      'mt-1.5 text-right text-[0.76rem] tabular',
                      enough ? 'text-ok' : 'text-muted',
                    )}
                  >
                    {enough ? `${count} characters` : `${count} / ${question.minChars} characters`}
                  </p>
                </>
              )}
            </Field>
          );
        })}
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        disabled={!complete}
        hint="Please give a little more detail on each answer before continuing."
      />
    </>
  );
}

export default WrittenStep;
