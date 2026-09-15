import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { adminNotAttended, adminNotAttendedPreview } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * "Not attended" -- the confirm dialog, shared by the dashboard and the calendar.
 *
 * Built once so the two screens cannot drift. Everything it says comes from
 * the server's preview: whether the press is allowed, which of the two paths
 * it takes, and the exact email, rendered the way the outbox renders it at
 * send time. The dialog decides nothing itself -- the press re-decides inside
 * its own transaction, so a preview that goes stale while this is open is
 * refused there, and the refusal is shown here.
 *
 * `onDone(result)` is called after a successful press, with the server's
 * answer (including the one-time booking token on the re-book path), so the
 * page can reload and, when email is off, show the new link by hand.
 */
export function NotAttendedModal({ applicant, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('rendered');

  useEffect(() => {
    let cancelled = false;
    adminNotAttendedPreview(applicant.id)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [applicant.id]);

  const final = preview?.path === 'final';

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await adminNotAttended(applicant.id);
      onDone?.({ ...result, emailLive: preview?.emailLive === true, applicant: preview?.applicant });
    } catch (failure) {
      // 409: something changed since the preview (another manager, a double
      // press). The message says what; nothing was changed by this press.
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal titleId="not-attended-title" className="max-w-2xl" onClose={() => (busy ? null : onClose())}>
      <h2 id="not-attended-title" className="text-[1.15rem] font-bold text-ink">
        {final ? 'Not attended — final' : 'Not attended'}: {applicant.fullName}
      </h2>

      {!preview && !error ? (
        <p role="status" className="mt-3 text-[0.9rem] text-muted">
          Checking…
        </p>
      ) : null}

      {preview && !preview.eligible ? (
        <p className="mt-3 rounded-panel border border-line bg-lav-soft/60 p-3 text-[0.9rem] leading-relaxed text-ink">
          {preview.message}
        </p>
      ) : null}

      {preview?.eligible ? (
        <>
          <p className="mt-2 text-[0.88rem] text-muted">
            Interview on <b className="font-semibold text-ink">{formatDateTime(preview.interview.startsAt)}</b>{' '}
            (your time).
          </p>

          <div
            className={cn(
              'mt-4 rounded-panel border p-4 text-[0.88rem] leading-relaxed',
              final ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <p className="font-bold">This will:</p>
            {final ? (
              <ul className="mt-1 grid gap-0.5">
                <li>· record this final interview as missed</li>
                <li>
                  · <b>decline the application</b>, recorded against you
                </li>
                <li>
                  · <b>add {preview.applicant.email} to do-not-rehire</b> — any future application
                  from that address is declined automatically
                </li>
                <li>· send the email below — and not the ordinary decline email as well</li>
              </ul>
            ) : (
              <ul className="mt-1 grid gap-0.5">
                <li>· record the interview as missed, and remove it from the calendar</li>
                <li>
                  · create <b>one final re-book link</b>, valid for {preview.expiryDays} days
                </li>
                <li>· send the email below</li>
                <li>
                  · if they miss the re-booked interview, or don&rsquo;t re-book within{' '}
                  {preview.expiryDays} days, the application is closed and they are added to
                  do-not-rehire
                </li>
              </ul>
            )}
          </div>

          <p
            className={cn(
              'mt-3 flex items-start gap-2 rounded-panel border p-3 text-[0.85rem] leading-relaxed',
              preview.emailLive
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-line bg-lav-soft/60 text-muted',
            )}
          >
            <Icon name={preview.emailLive ? 'alert' : 'file'} size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              {preview.emailLive ? (
                <>
                  <b className="font-semibold">A real email is sent immediately</b> to{' '}
                  {preview.applicant.email}. It cannot be recalled.
                </>
              ) : (
                <>
                  No email will reach them: it is written to a file on the server instead.
                  {final ? ' Tell them yourself.' : ' You will be shown the new link to send yourself.'}
                </>
              )}
            </span>
          </p>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.8rem] font-bold uppercase tracking-wide text-muted">
                The email · {preview.email.subject}
              </p>
              <div className="flex gap-1" role="group" aria-label="Email view">
                {['rendered', 'text'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      'rounded-control px-2.5 py-1 text-[0.78rem] font-semibold',
                      view === v ? 'bg-ink text-white' : 'border border-line bg-white text-ink',
                    )}
                  >
                    {v === 'rendered' ? 'As sent' : 'Plain text'}
                  </button>
                ))}
              </div>
            </div>
            {preview.email.html && view === 'rendered' ? (
              // Sandboxed, as on the templates screen: the email's styles must
              // not leak into the dashboard, and nothing in it can run.
              <iframe
                title={`${preview.email.subject} — as the candidate receives it`}
                srcDoc={preview.email.html}
                sandbox=""
                className="mt-2 h-[380px] w-full rounded-panel border border-line bg-white"
              />
            ) : (
              <pre className="mt-2 max-h-[380px] overflow-auto whitespace-pre-wrap rounded-panel border border-line bg-lav-soft/60 p-3 font-mono text-[0.8rem] leading-relaxed text-body">
                {preview.email.text}
              </pre>
            )}
            {!final ? (
              <p className="mt-1.5 text-[0.76rem] text-muted">
                The booking link in the preview is a placeholder — the real one is created when you
                confirm.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[0.86rem] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {preview?.eligible ? 'Cancel' : 'Close'}
        </Button>
        {preview?.eligible ? (
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {busy
              ? 'Saving…'
              : final
                ? 'Mark not attended & close application'
                : 'Mark not attended & send email'}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

export default NotAttendedModal;
