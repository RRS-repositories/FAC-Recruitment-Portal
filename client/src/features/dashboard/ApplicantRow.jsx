import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Flag } from '@/components/ui/Flag';
import { COL, COLUMN_COUNT, CHEVRON_WIDTH } from './columns';
import { ROLES } from '@/data/roles';
import { WRITTEN_QUESTIONS } from '@/data/writtenQuestions';
import { gradeFor } from '@shared/scoring';
import { aiLevelLabel } from '@shared/aiDetect';
import { adminApplication, adminDownloadCv, adminSendMeetingLink } from '@/lib/api';
import { normaliseApplicant } from '@/lib/normalise';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
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
// A level we do not recognise is not reassuring and not an accusation --
// it is a fault. Drawn neutral, and labelled "Not checked", so it reads as
// something to look into rather than as a verdict either way.
const aiTone = (level) => AI_TONE[level] ?? 'quiet';

/**
 * Template keys read as machine names. A manager should see what the email
 * was, not what it is called in the code.
 */
const EMAIL_LABEL = {
  'recruit.ack': 'Application received',
  'recruit.india.accept': 'Shortlisted, with booking link',
  'recruit.sa.accept': 'Shortlisted, with booking link',
  'recruit.india.decline': 'Not successful',
  'recruit.sa.decline': 'Not successful',
  'recruit.booking.confirmed': 'Interview booked',
  'recruit.rescheduled': 'Interview moved',
  'recruit.cancelled': 'Interview cancelled',
  'recruit.reminder.24h': 'Reminder, 24 hours before',
  'recruit.reminder.10m': 'Reminder, 10 minutes before',
  'recruit.noshow': 'We missed you, rebook',
  'recruit.meet.link': 'Joining link',
};

/** One email's state, in words rather than a status code. */
function deliveryState(email) {
  if (email.cancelled_at)
    return { text: `Called off — ${email.last_error ?? 'no longer needed'}`, tone: 'quiet' };
  if (email.sent_at) return { text: `Sent ${formatDateTime(email.sent_at)}`, tone: 'ok' };
  if (email.attempts >= 6)
    return { text: `Failed after ${email.attempts} attempts`, tone: 'danger' };
  if (email.attempts > 0) return { text: `Failed ${email.attempts}×, trying again`, tone: 'warn' };
  if (new Date(email.send_after) > new Date()) {
    return { text: `Scheduled for ${formatDateTime(email.send_after)}`, tone: 'quiet' };
  }
  return { text: 'Queued, sending shortly', tone: 'quiet' };
}

const DELIVERY_TEXT = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  quiet: 'text-muted',
};

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
export function ApplicantRow({
  applicant,
  onDecide,
  onReissue,
  onAttendance,
  fastSubmitSeconds = 240,
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [emails, setEmails] = useState(null);
  const [mailMode, setMailMode] = useState(null);
  // The model's review of this application, and the rule score beside it. Both
  // arrive with the detail, so neither costs a request of its own.
  const [review, setReview] = useState(null);
  const [ruleScore, setRuleScore] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [busy, setBusy] = useState('');
  // The link panel: closed, or open with whatever is being typed into it.
  const [linkPanel, setLinkPanel] = useState(null);
  const [linkError, setLinkError] = useState('');
  const [linkSent, setLinkSent] = useState('');

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
        if (cancelled) return;
        setDetail(normaliseApplicant(result.application));
        setEmails(result.emails ?? []);
        setMailMode(result.mailMode ?? null);
        setReview(result.review ?? null);
        setRuleScore(result.ruleScore ?? null);
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

  // An accepted applicant always has somewhere their link could go wrong.
  const canReissue =
    applicant.status === 'accepted' && !['attended', 'no_show'].includes(applicant.interviewStatus);
  // Attendance is a record of something that happened, so the interview has
  // to have started before it can be recorded.
  const interviewPast =
    applicant.interviewAt != null && new Date(applicant.interviewAt) <= new Date();
  const canMark =
    interviewPast && ['booked', 'attended', 'no_show'].includes(applicant.interviewStatus);
  const marked = ['attended', 'no_show'].includes(applicant.interviewStatus);
  // Only worth offering once there is a time to join: a link with no
  // interview behind it is a link to nowhere.
  const canSendLink = applicant.interviewStatus === 'booked';

  const sendMeetingLink = async () => {
    setBusy('meetlink');
    setLinkError('');
    try {
      const result = await adminSendMeetingLink(applicant.id, linkPanel.trim());
      setLinkPanel(null);
      setLinkSent(
        result.delivered
          ? 'Sent. The reminders will carry the link too.'
          : 'Saved, but no email left the building - mail is going to a file. Send it by hand.',
      );
      // The email list in hand is now one short, and the saved link changed.
      setDetail(null);
    } catch (failure) {
      setLinkError(failure.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <tr className="border-b border-line align-top last:border-0 hover:bg-lav-soft/40">
        {/* Name, with the role underneath it rather than beside — the column
            is the narrowest thing on the row and a chip would push it wider. */}
        <td className={cn('px-3 py-4', COL.name)}>
          <b className="block truncate text-[0.95rem] font-bold leading-tight text-ink" title={applicant.fullName}>
            {applicant.fullName}
          </b>
          <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[0.76rem] text-muted">
            <Flag country={role?.countryCode} className="h-2.5 w-[15px] flex-shrink-0 rounded-[1px]" />
            {role?.short ?? applicant.role}
          </span>
        </td>

        <td className={cn('px-3 py-4', COL.email)}>
          <a
            href={`mailto:${applicant.email}`}
            title={applicant.email}
            className="block truncate text-[0.86rem] text-muted underline-offset-2 hover:text-violet-deep hover:underline"
          >
            {applicant.email}
          </a>
        </td>

        <td className={cn('px-3 py-4', COL.score)}>
          <b className={cn('block text-[0.95rem] font-bold leading-none tabular', GRADE_TEXT[grade.tone])}>
            {applicant.score}%
          </b>
          <span className="mt-1 block whitespace-nowrap text-[0.72rem] text-muted tabular">
            {formatDate(applicant.createdAt)}
          </span>
        </td>

        <td className={cn('px-3 py-4', COL.ai)}>
          <Badge tone={aiTone(applicant.ai.level)}>{aiLevelLabel(applicant.ai.level)}</Badge>
        </td>

        <td className={cn('px-3 py-4', COL.duration)}>
          <span
            className={cn(
              'whitespace-nowrap text-[0.86rem] tabular',
              fast && 'font-semibold text-warn',
            )}
          >
            {formatDuration(applicant.durationSec)}
          </span>
        </td>

        <td className={cn('px-3 py-4', COL.status)}>
          <Badge tone={STATUS_TONE[applicant.status]}>{applicant.status}</Badge>
        </td>

        <td className={cn('px-3 py-4', COL.interview)}>
          {applicant.interviewStatus === 'not_invited' ? (
            <span className="text-[0.86rem] text-muted">—</span>
          ) : (
            <>
              <Badge tone={INTERVIEW_TONE[applicant.interviewStatus]}>
                {INTERVIEW_LABEL[applicant.interviewStatus]}
              </Badge>
              {applicant.interviewAt ? (
                <span className="mt-1 block whitespace-nowrap text-[0.72rem] text-muted">
                  {formatDateTime(applicant.interviewAt)}
                </span>
              ) : null}
            </>
          )}
        </td>

        <td className={cn('px-3 py-4', COL.decision)}>
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
                className="grid h-9 w-9 place-items-center rounded-control bg-danger text-white transition-transform hover:scale-105 motion-reduce:hover:scale-100"
              >
                <Icon name="close" size={16} strokeWidth={2.6} />
              </button>
            </div>
          ) : (
            <span className="text-[0.86rem] text-muted">Done</span>
          )}
        </td>

        <td className={cn('py-4 pr-3', CHEVRON_WIDTH)}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={
              open
                ? `Hide details for ${applicant.fullName}`
                : `Show details for ${applicant.fullName}`
            }
            className="grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-lav-soft hover:text-violet-deep"
          >
            <Icon
              name="chevronDown"
              size={18}
              className={cn('transition-transform duration-200', open && 'rotate-180')}
            />
          </button>
        </td>
      </tr>

      {open ? (
        <tr className="border-b border-line last:border-0">
          <td colSpan={COLUMN_COUNT} className="p-0">
        <div
              role="region"
              aria-label={`Details for ${applicant.fullName}`}
              className="animate-fade-in border-t border-line bg-lav-soft/60 px-5 py-5 motion-reduce:animate-none"
            >
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Phone">{full.phone}</Detail>
            <Detail label="Applied">{formatDateTime(applicant.createdAt)}</Detail>
            <Detail label="Form open">{formatDuration(applicant.durationSec)}</Detail>
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

          {/* ── The model's review ───────────────────────────────────────────
              Deliberately below the behavioural flag, and deliberately quieter
              than it: this is a second opinion on a first reading, not a
              verdict. Everything shown is what the model said and why, because
              a score with no argument behind it is not something a manager can
              act on or defend. */}
          {review?.status === 'done' ? (
            <div className="mt-5 rounded-panel border border-line bg-lav-soft/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[0.8rem] font-bold uppercase tracking-wide text-violet-deep">
                  Model review
                </p>
                <p className="text-[0.75rem] text-muted">
                  {review.model}
                  {review.prompt_version ? ` · prompt v${review.prompt_version}` : ''}
                  {review.cv_chars ? ` · read ${review.cv_chars.toLocaleString()} characters of CV` : ' · no CV text'}
                </p>
              </div>

              <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[1.35rem] font-extrabold text-ink">{review.fitment_score}%</span>
                <span className="text-[0.82rem] text-muted">fit for this role</span>
                {/* The disagreement is the reason both numbers exist. Said out
                    loud only when it is wide enough to be worth a second look. */}
                {ruleScore !== null && Math.abs(ruleScore - review.fitment_score) >= 15 ? (
                  <span className="rounded-control bg-amber-100 px-2 py-0.5 text-[0.75rem] font-semibold text-amber-900">
                    questionnaire scored {ruleScore}% — worth a look
                  </span>
                ) : null}
              </p>

              {review.fitment_summary ? (
                <p className="mt-2 text-[0.88rem] leading-relaxed text-ink">{review.fitment_summary}</p>
              ) : null}

              {review.fitment_reasons?.length ? (
                <ul className="mt-2 grid gap-1">
                  {review.fitment_reasons.map((reason) => (
                    <li key={reason} className="text-[0.86rem] text-muted">· {reason}</li>
                  ))}
                </ul>
              ) : null}

              {review.ai_rationale ? (
                <p className="mt-3 border-t border-line pt-3 text-[0.84rem] text-muted">
                  <b className="font-semibold text-ink">On AI use — {review.ai_opinion}:</b>{' '}
                  {review.ai_rationale}
                </p>
              ) : null}

              <p className="mt-3 text-[0.8rem] italic text-muted">
                A machine's opinion, formed without meeting anyone. It decides nothing.
              </p>
            </div>
          ) : null}

          {/* Silence would read as "the model saw nothing wrong", which is the
              opposite of the truth when it never ran. */}
          {review && review.status !== 'done' ? (
            <p className="mt-5 text-[0.84rem] text-muted">
              {review.status === 'queued'
                ? 'The model has not reviewed this application yet.'
                : review.status === 'skipped'
                  ? 'This application was not sent for review.'
                  : `The review could not be completed${review.last_error ? `: ${review.last_error}` : '.'}`}
            </p>
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
              {detailError}{' '}
              <button type="button" onClick={() => setDetail(null)} className="underline">
                Try again
              </button>
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {applicant.cvDeletedAt ? (
              // Deleted under the retention policy, said plainly. A missing
              // button would look like something broke.
              <span className="text-[0.84rem] text-muted">
                CV deleted {formatDateTime(applicant.cvDeletedAt)} — retention policy
              </span>
            ) : applicant.cvFilename ? (
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

          {emails && emails.length > 0 ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
                Emails
              </p>
              <ul className="grid gap-1.5">
                {emails.map((email) => {
                  const state = deliveryState(email);
                  return (
                    <li
                      key={email.id}
                      className="flex flex-wrap items-baseline gap-x-2 text-[0.84rem]"
                    >
                      <span className="text-ink">
                        {EMAIL_LABEL[email.template] ?? email.template}
                      </span>
                      <span className={cn('text-[0.8rem]', DELIVERY_TEXT[state.tone])}>
                        · {state.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {mailMode === 'file' ? (
                // Said here, next to the list, because this list otherwise
                // reads exactly like proof the candidate was contacted.
                <p className="mt-2 text-[0.78rem] leading-relaxed text-warn">
                  Not actually delivered — no mailbox is configured yet, so these were written to a
                  file on the server. Send the booking link by hand.
                </p>
              ) : null}
            </div>
          ) : null}

          {canReissue || canMark || marked || canSendLink ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
                Interview
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {canReissue ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      setBusy('link');
                      await onReissue?.(applicant.id);
                      // The reissue queued another email; the list in hand is
                      // now one short. Dropping the detail refetches both.
                      setDetail(null);
                      setBusy('');
                    }}
                  >
                    <Icon name="mail" size={15} />
                    {busy === 'link'
                      ? 'Creating…'
                      : applicant.interviewStatus === 'not_invited'
                        ? 'Create booking link'
                        : 'New booking link'}
                  </Button>
                ) : null}

                {canSendLink ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(busy)}
                    aria-expanded={linkPanel !== null}
                    onClick={() => {
                      setLinkError('');
                      setLinkSent('');
                      // Pre-filled with the link already saved, so updating a
                      // link is editing rather than retyping.
                      setLinkPanel(linkPanel === null ? (full.meetLink ?? '') : null);
                    }}
                  >
                    <Icon name="video" size={15} />
                    {full.meetLink ? 'Update meeting link' : 'Send meeting link'}
                  </Button>
                ) : null}

                {canMark ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={Boolean(busy) || applicant.interviewStatus === 'attended'}
                      onClick={async () => {
                        setBusy('attended');
                        await onAttendance?.(applicant.id, 'attended');
                        setDetail(null);
                        setBusy('');
                      }}
                    >
                      <Icon name="check" size={15} />
                      {busy === 'attended' ? 'Saving…' : 'They attended'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={Boolean(busy) || applicant.interviewStatus === 'no_show'}
                      onClick={async () => {
                        setBusy('no_show');
                        await onAttendance?.(applicant.id, 'no_show');
                        setDetail(null);
                        setBusy('');
                      }}
                    >
                      <Icon name="close" size={15} />
                      {busy === 'no_show' ? 'Saving…' : 'No-show'}
                    </Button>
                  </>
                ) : null}

                {marked ? (
                  <span className="text-[0.84rem] text-muted">
                    Recorded as{' '}
                    <b className="font-semibold text-ink">
                      {applicant.interviewStatus === 'attended' ? 'attended' : 'a no-show'}
                    </b>
                    .
                  </span>
                ) : null}
              </div>

              {/* Where the link is pasted. Inline rather than a dialog: it is
                  a single field, and the interview time it belongs to is
                  already on screen above it. */}
              {linkPanel !== null ? (
                <div className="mt-3 rounded-panel border border-line bg-lav-soft/60 p-3">
                  <label
                    className="block text-[0.78rem] font-semibold text-ink"
                    htmlFor={`meetlink-${applicant.id}`}
                  >
                    Meeting link
                  </label>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">
                    Paste the Teams, Meet or Zoom link. It is emailed to{' '}
                    <b className="font-semibold text-ink">{applicant.email}</b> and saved, so both
                    reminders carry it from now on.
                  </p>
                  <input
                    id={`meetlink-${applicant.id}`}
                    type="url"
                    inputMode="url"
                    value={linkPanel}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="https://teams.microsoft.com/l/meetup-join/..."
                    onChange={(e) => setLinkPanel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && linkPanel.trim() && !busy) sendMeetingLink();
                    }}
                    className="mt-2 w-full rounded-control border border-line bg-white px-3 py-2 text-[0.86rem] text-ink placeholder:text-muted/70 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/40"
                  />
                  {linkError ? (
                    <p role="alert" className="mt-2 text-[0.82rem] font-medium text-danger">
                      {linkError}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={Boolean(busy) || !linkPanel.trim()}
                      onClick={sendMeetingLink}
                    >
                      <Icon name="mail" size={15} />
                      {busy === 'meetlink' ? 'Sending...' : 'Send to candidate'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        setLinkPanel(null);
                        setLinkError('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {linkSent ? (
                <p role="status" className="mt-2 text-[0.82rem] font-medium text-ink">
                  {linkSent}
                </p>
              ) : null}

              {/* Once it is saved there is no guessing whether it went. */}
              {canSendLink && full.meetLink && linkPanel === null ? (
                <p className="mt-2 break-all text-[0.78rem] leading-relaxed text-muted">
                  Current link:{' '}
                  <a
                    href={full.meetLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-violet underline underline-offset-2"
                  >
                    {full.meetLink}
                  </a>
                </p>
              ) : null}

              {/* A booking link that has not been sent is the commonest way a
                  candidate gets stuck: it is shown once and cannot be looked
                  up again. Say so where the button is. */}
              {canReissue && applicant.interviewStatus !== 'not_invited' ? (
                <p className="mt-2 text-[0.78rem] leading-relaxed text-muted">
                  Creating a new link stops the old one working. Use it if the first never arrived —
                  it is shown once and cannot be looked up later.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default ApplicantRow;
