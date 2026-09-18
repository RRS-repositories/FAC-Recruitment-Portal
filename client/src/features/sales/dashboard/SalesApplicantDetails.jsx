import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminVoiceNote } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import { chosenLabels, voiceNoteFilename, wordCount } from './salesDetail';

/**
 * The sales applicant's part of the expanded dashboard row.
 *
 * It stands in for the written-answers block ApplicantRow draws for the other
 * roles -- that block is labelled from the paralegal questions, which would be
 * the wrong questions here. Everything else in the row (phone, AI flag, model
 * review, CV, emails, interview) is ApplicantRow's and is not repeated.
 *
 * The labels come from the detail response (`writtenQuestions`, `assessment`)
 * rather than from client data, so they are always the questions this
 * applicant was actually asked.
 */

/** Same shape and type scale as ApplicantRow's own Detail. */
function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.88rem] text-ink">{children || '—'}</dd>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">{children}</p>
  );
}

/** A grey block the size of what is coming, so the layout does not jump. */
function Placeholder({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-panel bg-white/70 motion-reduce:animate-none', className)}
    />
  );
}

// Two glyphs the shared icon set does not have, drawn on the same 24px grid
// and stroke so they sit with it. Kept here rather than added to Icon.jsx.
const Glyph = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width={15}
    height={15}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);
const PlayGlyph = () => (
  <Glyph>
    <path d="M7 4.5v15l12-7.5z" />
  </Glyph>
);
const DownloadGlyph = () => (
  <Glyph>
    <path d="M12 4v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </Glyph>
);

const SOURCE_LABEL = { recorded: 'recorded in the form', uploaded: 'uploaded file' };

/**
 * The voice note: fetched once, on the first Play or Download, because it
 * needs the auth header and so cannot be a plain <audio src>. The object URL
 * lives as long as this component and is revoked when it goes.
 */
function VoiceNote({ applicant, voice }) {
  const [url, setUrl] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Gone under retention between the detail loading and the click: the server
  // says 410, and the row then says so in the same words it would have.
  const [gone, setGone] = useState(false);
  const urlRef = useRef(null);
  const blobRef = useRef(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const load = async () => {
    if (blobRef.current) return blobRef.current;
    const blob = await adminVoiceNote(applicant.id);
    blobRef.current = blob;
    urlRef.current = URL.createObjectURL(blob);
    setUrl(urlRef.current);
    return blob;
  };

  const run = async (what, then) => {
    setBusy(what);
    setError('');
    try {
      await load();
      then();
    } catch (failure) {
      if (failure.status === 410) setGone(true);
      else setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const play = () => run('play', () => setShowPlayer(true));

  const download = () =>
    run('download', () => {
      const link = document.createElement('a');
      link.href = urlRef.current;
      link.download = voiceNoteFilename(applicant.fullName, voice);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });

  const deletedAt = voice?.deletedAt ?? null;

  const meta = [
    voice?.durationSec != null ? formatDuration(voice.durationSec) : null,
    voice?.source ? SOURCE_LABEL[voice.source] : null,
  ].filter(Boolean);

  return (
    <div>
      <SectionTitle>
        Voice note
        {meta.length > 0 ? (
          <span className="font-medium normal-case tracking-normal"> · {meta.join(' · ')}</span>
        ) : null}
      </SectionTitle>

      {deletedAt || gone ? (
        // Said plainly, as the CV is. A missing button would look like a fault.
        <p className="text-[0.84rem] text-muted">
          Voice note deleted{deletedAt ? ` ${formatDateTime(deletedAt)}` : ''} — retention policy
        </p>
      ) : !voice?.present ? (
        <p className="text-[0.84rem] text-muted">No voice note</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!showPlayer ? (
              <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={play}>
                <PlayGlyph />
                {busy === 'play' ? 'Loading…' : 'Play voice note'}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={download}>
              <DownloadGlyph />
              {busy === 'download' ? 'Preparing…' : 'Download voice note'}
            </Button>
            {error ? (
              <span role="alert" className="text-[0.84rem] font-medium text-danger">
                {error}
              </span>
            ) : null}
          </div>
          {showPlayer && url ? (
            <audio
              controls
              autoPlay
              preload="metadata"
              src={url}
              aria-label={`Voice note from ${applicant.fullName}`}
              className="mt-3 w-full max-w-md"
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export function SalesApplicantDetails({ applicant, detail: incoming, writtenQuestions, assessment }) {
  // ApplicantRow drops its detail to refetch it after an action (a new link,
  // attendance). Holding on to the last one keeps this on screen meanwhile --
  // and keeps the voice note mounted, so it is not fetched a second time.
  const last = useRef(incoming);
  if (incoming) last.current = incoming;
  const detail = incoming ?? last.current;

  // Until the first detail arrives there is nothing sales-specific to show:
  // the list row carries no answers, profile or voice metadata.
  if (!detail) {
    return (
      <div className="mt-5 grid gap-4">
        <Placeholder className="h-11 max-w-xs" />
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
      <div className="mt-5 border-t border-line pt-4">
        <VoiceNote applicant={applicant} voice={detail.voice ?? null} />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <SectionTitle>Details</SectionTitle>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="City">{profile.city}</Detail>
          <Detail label="Qualification">{profile.qualification}</Detail>
          <Detail label="Experience">{profile.experience}</Detail>
          <Detail label="Heard about us">{profile.heardFrom}</Detail>
          <Detail label="Notice period">{profile.noticePeriod}</Detail>
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
                    {index + 1}. {question.question}
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

export default SalesApplicantDetails;
