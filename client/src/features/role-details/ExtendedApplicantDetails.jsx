import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { Detail, Placeholder, SectionTitle } from './DetailParts';
import { chosenLabels, externalHref, questionText, wordCount } from './detailFormat';

/**
 * The part of the expanded dashboard row for a role that asks its own
 * questions -- sales, AI developer -- in place of the written-answers block
 * ApplicantRow draws for intern and paralegal (that block is labelled from the
 * paralegal questions, which would be the wrong questions here). Everything
 * else in the row (phone, AI flag, model review, CV, emails, interview) is
 * ApplicantRow's and is not repeated.
 *
 * Sections, in order: the role's own (a voice note, for sales -- passed in as
 * `renderVoice`, so this file knows nothing about audio), Details (the
 * profile, from the role's `fields`), Written answers, Assessment responses.
 *
 * The labels come from the detail response (`writtenQuestions`, `assessment`)
 * rather than from client data, so they are always the questions this
 * applicant was actually asked.
 *
 * `fields` is a list of `{ key, label, kind? }` read from `detail.profile`.
 * `kind: 'link'` draws the value as an external link when it is http(s), and
 * as plain text otherwise.
 */

// A function, not a component: Detail shows its dash for an empty value, and
// an element is never empty even when it would render nothing.
function linkOrText(value) {
  const href = externalHref(value);
  const text = typeof value === 'string' ? value.trim() : '';
  if (!href) return text || null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all font-medium text-violet underline underline-offset-2 hover:text-violet-deep"
    >
      {text}
    </a>
  );
}

export function ExtendedApplicantDetails({
  detail: incoming,
  writtenQuestions,
  assessment,
  fields,
  renderVoice,
}) {
  // ApplicantRow drops its detail to refetch it after an action (a new link,
  // attendance). Holding on to the last one keeps this on screen meanwhile --
  // and keeps a voice note mounted, so it is not fetched a second time.
  const last = useRef(incoming);
  if (incoming) last.current = incoming;
  const detail = incoming ?? last.current;

  // Until the first detail arrives there is nothing role-specific to show:
  // the list row carries no answers, profile or voice metadata.
  if (!detail) {
    return (
      <div className="mt-5 grid gap-4">
        {renderVoice ? <Placeholder className="h-11 max-w-xs" /> : null}
        <Placeholder className="h-14" />
        <Placeholder className="h-20" />
      </div>
    );
  }

  const profile = detail.profile ?? {};
  const written = detail.written ?? {};
  const answers = detail.answers ?? {};

  // The detail response names the questions. Should it ever not, the answers
  // are still shown, under their ids, rather than hidden.
  const questions = Array.isArray(writtenQuestions)
    ? writtenQuestions
    : Object.keys(written).map((id) => ({ id, label: id }));

  return (
    <>
      {renderVoice ? <div className="mt-5 border-t border-line pt-4">{renderVoice(detail)}</div> : null}

      <div className="mt-5 border-t border-line pt-4">
        <SectionTitle>Details</SectionTitle>
        <dl className="grid gap-4 sm:grid-cols-3">
          {(fields ?? []).map((field) => (
            <Detail key={field.key} label={field.label}>
              {field.kind === 'link' ? linkOrText(profile[field.key]) : profile[field.key]}
            </Detail>
          ))}
        </dl>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <SectionTitle>Written answers</SectionTitle>
        <div className="grid gap-4">
          {questions.map((question) => {
            const answer = written[question.id];
            const words = wordCount(answer);
            const short = Number.isFinite(question.minWords) && words < question.minWords;
            return (
              <div key={question.id}>
                <p className="text-[0.78rem] font-semibold text-muted">
                  {question.label}
                  {answer ? (
                    <span className={cn('ml-1.5 font-normal', short && 'text-warn')}>
                      · {words} word{words === 1 ? '' : 's'}
                      {short ? ` (asked for ${question.minWords})` : ''}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 whitespace-pre-wrap rounded-panel bg-white p-3.5 text-[0.88rem] leading-relaxed text-body">
                  {answer || '—'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {Array.isArray(assessment) && assessment.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <SectionTitle>Assessment responses</SectionTitle>
          <ol className="grid gap-3">
            {assessment.map((question, index) => {
              const labels = chosenLabels(question, answers[question.id]);
              return (
                <li key={question.id} className="rounded-panel bg-white p-3.5">
                  <p className="text-[0.78rem] font-semibold text-muted">
                    {index + 1}. {questionText(question)}
                    {question.multi ? <span className="font-normal"> · more than one allowed</span> : null}
                  </p>
                  {labels.length === 0 ? (
                    <p className="mt-1 text-[0.88rem] text-muted">Not answered</p>
                  ) : labels.length === 1 ? (
                    <p className="mt-1 text-[0.88rem] leading-relaxed text-ink">{labels[0]}</p>
                  ) : (
                    <ul className="mt-1 grid gap-1">
                      {labels.map((label) => (
                        <li key={label} className="text-[0.88rem] leading-relaxed text-ink">
                          · {label}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </>
  );
}

export default ExtendedApplicantDetails;
