import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ROLES } from '@/data/roles';
import { WRITTEN_QUESTIONS } from '@/data/writtenQuestions';
import { gradeFor } from '@shared/scoring';
import { AI_LEVEL_LABEL } from '@shared/aiDetect';
import { adminApplication, adminDownloadCv } from '@/lib/api';
import { normaliseApplicant } from '@/lib/normalise';
import { formatDateTime, formatDuration, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const STATUS_TONE = { pending: 'warn', accepted: 'ok', declined: 'danger' };

const INTERVIEW_LABEL = {
  not_invited: 'Not invited',
  invited: 'Link sent',
  booked: 'Booked',
  attended: 'Attended',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};
const INTERVIEW_TONE = {
  not_invited: 'quiet',
  invited: 'info',
  booked: 'violet',
  attended: 'ok',
  no_show: 'danger',
  cancelled: 'quiet',
};

const AI_TONE = { clean: 'ok', possible: 'warn', ai_used: 'danger' };

// Written out in full, not built as `text-${tone}`. Tailwind scans source for
// complete class names, so an interpolated one is never generated and the text
// silently loses its colour.
const GRADE_TEXT = {
  ok: 'text-ok',
  violet: 'text-violet-deep',
  warn: 'text-warn',
  danger: 'text-danger',
};

/** A stat that only appears when it is worth reading. */
function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.88rem] text-ink">{children}</dd>
    </div>
  );
}

/**
 * One applicant.
 *
 * The collapsed row carries only what a manager triages on — who, role, score,
 * AI flag, interview state. Everything else is one click away, because a table
 * that shows everything shows nothing.
 *
 * The written answers are the bulk of a record and are not on the list
 * response: fetching all of them for twenty-five rows to show none of them
 * would be most of the payload wasted. They load when a row is opened, once,
 * and are kept for the rest of the page's life.
 */
export function ApplicantRow({ applicant, onDecide, fastSubmitSeconds = 240 }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const role = ROLES[applicant.role];
  const grade = gradeFor(applicant.score);
  const fast = applicant.durationSec != null && applicant.durationSec < fastSubmitSeconds;

  useEffect(() => {
    if (!open || detail) return undefined;

    // The row can be closed — or the whole list refiltered out from under it —
    // while this is in flight. `cancelled` keeps that from setting state on a
    // component that is no longer showing the answer.
    let cancelled = false;
    setDetailError('');

    adminApplication(applicant.id)
      .then((result) => {
        if (!cancelled) setDetail(normaliseApplicant(result.application));
      })
      .catch((failure) => {
        if (!cancelled) setDetailError(failure.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open, detail, applicant.id]);

  const download = async () => {
    setDownloadError('');
    try {
      await adminDownloadCv(applicant.id, applicant.cvFilename);
    } catch (failure) {
      setDownloadError(failure.message);
    }
  };

  const full = detail ?? applicant;

  return (
    <li className="border-b border-line last:border-0">
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-lav text-[0.75rem] font-bold text-violet-deep"
            >
              {initials(applicant.fullName)}
            </span>
            <b className="text-[0.98rem] font-semibold text-ink">{applicant.fullName}</b>
            <Badge tone="neutral">{role?.short ?? applicant.role}</Badge>
            <Badge tone={STATUS_TONE[applicant.status]}>{applicant.status}</Badge>
            {applicant.ai.level !== 'clean' ? (
              <Badge tone={AI_TONE[applicant.ai.level]}>
                <Icon name="sparkle" size={11} />
                {AI_LEVEL_LABEL[applicant.ai.level]}
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-[0.84rem] text-muted">
            <a href={`mailto:${applicant.email}`} className="text-violet-deep underline underline-offset-2">
              {applicant.email}
            </a>
            <span>{formatDateTime(applicant.createdAt)}</span>
            <span className={cn('tabular', fast && 'font-semibold text-warn')}>
              {formatDuration(applicant.durationSec)}
              {fast ? ' · fast' : ''}
            </span>
            <Badge tone={INTERVIEW_TONE[applicant.interviewStatus]}>
              {INTERVIEW_LABEL[applicant.interviewStatus]}
            </Badge>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 pl-11 sm:pl-0">
          <div className="text-right">
            <b className="block text-[1.35rem] font-black leading-none text-ink tabular">
              {applicant.score}
            </b>
            <span className={cn('text-[0.72rem] font-semibold', GRADE_TEXT[grade.tone])}>
              {grade.label}
            </span>
          </div>

          {applicant.status === 'pending' ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onDecide(applicant.id, 'accepted')}
                aria-label={`Accept ${applicant.fullName}`}
                className="grid h-9 w-9 place-items-center rounded-control bg-emerald-600 text-white transition-transform hover:scale-105 motion-reduce:hover:scale-100"
              >
                <Icon name="check" size={16} strokeWidth={2.6} />
              </button>
              <button
                type="button"
                onClick={() => onDecide(applicant.id, 'declined')}
                aria-label={`Decline ${applicant.fullName}`}
                className="grid h-9 w-9 place-items-center rounded-control bg-white text-danger ring-1 ring-line transition-transform hover:scale-105 motion-reduce:hover:scale-100"
              >
                <Icon name="close" size={16} strokeWidth={2.6} />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? `Hide details for ${applicant.fullName}` : `Show details for ${applicant.fullName}`}
            className="grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-lav-soft hover:text-violet-deep"
          >
            <Icon
              name="chevronDown"
              size={18}
              className={cn('transition-transform duration-200', open && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {open ? (
        <div className="animate-fade-in border-t border-line bg-lav-soft/60 px-5 py-5 motion-reduce:animate-none">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Phone">{full.phone}</Detail>
            <Detail label="Applied">{formatDateTime(applicant.createdAt)}</Detail>
            <Detail label="Time taken">{formatDuration(applicant.durationSec)}</Detail>
          </dl>

          {applicant.decidedByEmail ? (
            <p className="mt-4 text-[0.82rem] text-muted">
              {applicant.status === 'accepted' ? 'Accepted' : 'Declined'} by{' '}
              <b className="font-semibold text-ink">{applicant.decidedByEmail}</b>
              {applicant.decidedAt ? ` on ${formatDateTime(applicant.decidedAt)}` : ''}.
            </p>
          ) : null}

          {applicant.ai.reasons.length > 0 ? (
            <div className="mt-5 rounded-panel border border-amber-200 bg-amber-50 p-4">
              <p className="text-[0.8rem] font-bold uppercase tracking-wide text-amber-800">
                Why this was flagged · {applicant.ai.score}% confidence
              </p>
              <ul className="mt-2 grid gap-1">
                {applicant.ai.reasons.map((reason) => (
                  <li key={reason} className="text-[0.86rem] text-amber-900">
                    · {reason}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.8rem] italic text-amber-800">
                An indicator, not proof. Read the answers before deciding.
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            {WRITTEN_QUESTIONS.map((question) => (
              <div key={question.id}>
                <p className="text-[0.78rem] font-semibold text-muted">{question.label}</p>
                {full.written ? (
                  <p className="mt-1 whitespace-pre-wrap rounded-panel bg-white p-3.5 text-[0.88rem] leading-relaxed text-body">
                    {full.written[question.id] ?? '—'}
                  </p>
                ) : (
                  // A grey block the size of the answer, so the layout does not
                  // jump when it arrives.
                  <div
                    aria-hidden="true"
                    className="mt-1 h-20 animate-pulse rounded-panel bg-white/70 motion-reduce:animate-none"
                  />
                )}
              </div>
            ))}
          </div>

          {!full.written ? (
            <p role="status" className="sr-only">
              {detailError ? detailError : 'Loading answers'}
            </p>
          ) : null}

          {detailError ? (
            <p className="mt-3 text-[0.84rem] font-medium text-danger">
              {detailError} <button type="button" onClick={() => setDetail(null)} className="underline">Try again</button>
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {applicant.cvFilename ? (
              <Button variant="secondary" size="sm" onClick={download}>
                <Icon name="file" size={15} />
                Download CV
              </Button>
            ) : (
              <span className="text-[0.84rem] text-muted">No CV on file</span>
            )}
            {applicant.interviewAt ? (
              <span className="inline-flex items-center gap-2 rounded-control border-[1.5px] border-line bg-white px-4 py-2 text-[0.85rem] font-semibold text-ink">
                <Icon name="calendar" size={15} />
                Interview {formatDateTime(applicant.interviewAt)}
              </span>
            ) : null}
            {downloadError ? (
              <span role="alert" className="text-[0.84rem] font-medium text-danger">
                {downloadError}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default ApplicantRow;
