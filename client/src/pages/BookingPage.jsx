import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { cancelBooking, confirmBooking, fetchBooking, rescheduleBooking } from '@/lib/api';
import { roleFromApiKey } from '@/lib/normalise';
import { COMPANY } from '@/data/company';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';

/** "Priyanshu Srivastava" -> "PS". Two letters at most; an avatar is not a name. */
const initialsOf = (name) =>
  String(name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Candidate self-service interview booking.
 *
 * Every time is shown twice — the candidate's own zone first, UK second. A
 * cross-timezone invitation that shows one bare time is how people join an
 * hour late, and the candidate should never have to do the arithmetic.
 *
 * Both strings come from the server rather than being formatted here. The
 * candidate's timezone lives on their application record; the browser's zone
 * is a guess that is wrong for anyone travelling, and a booking page is not
 * the place to be approximately right about what time something is.
 *
 * The token in the URL is the whole credential — there is no login, because
 * the candidate has no account.
 */

/**
 * The server answers `expired` and `cancelled` as codes, not sentences: a
 * message that must not vary is not a message. The wording lives here, where
 * the rest of the copy is.
 */
const DEAD_LINK = {
  expired: {
    icon: 'clock',
    title: 'This booking link has expired',
    body: 'Booking links are valid for 14 days. Reply to your invitation email and we’ll send you a new one.',
  },
  cancelled: {
    icon: 'close',
    title: 'This interview was cancelled',
    body: 'If that was a mistake, or you’d like to rebook, just reply to your invitation email.',
  },
};

/** The panel every terminal state uses, so they cannot drift apart. */
function Notice({ icon, tone = 'neutral', title, children }) {
  const TONES = {
    neutral: 'bg-lav text-violet-deep',
    warn: 'bg-amber-100 text-amber-700',
    success: 'bg-cta text-white',
  };
  return (
    <AppShell>
      <Card className="mx-auto my-12 max-w-form text-center">
        <span
          aria-hidden="true"
          className={cn('mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full', TONES[tone])}
        >
          <Icon name={icon} size={22} strokeWidth={2.4} />
        </span>
        <h1 className="text-display-md font-extrabold text-ink">{title}</h1>
        <div className="mt-3 text-[0.95rem] leading-relaxed text-muted">{children}</div>
      </Card>
    </AppShell>
  );
}

export function BookingPage() {
  const { token } = useParams();

  usePageMeta({
    title: 'Book your interview — Fast Action Claims',
    // A page reached by a secret link, showing a named person's interview.
    robots: 'noindex, nofollow',
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deadLink, setDeadLink] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Set once a booking is made in this session, so the confirmation can say
  // "booked" rather than the "already booked" the server reports on reload.
  const [justBooked, setJustBooked] = useState(null);
  const [moving, setMoving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const errorRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await fetchBooking(token);
      setData(result);
      setDayIndex(0);
      setSelected(null);
    } catch (failure) {
      // 404 and 410 both mean "this link is no longer good". The server
      // deliberately does not distinguish a wrong token from an expired one.
      const code = failure.payload?.error;
      if (code === 'expired' || code === 'cancelled') setDeadLink(code);
      else setLoadError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Re-reads the interview without the loading skeleton.
   *
   * Booking and rescheduling return only the new slot, so the record in hand
   * still carries the reschedule count from page load. Left stale, the page
   * would go on offering "change my time" after the second change had used
   * the last one up — and the server would then refuse a button it had just
   * been shown. A failure here is not worth surfacing: the confirmation being
   * displayed is still true, it is only the counter that may lag.
   */
  const refresh = useCallback(async () => {
    try {
      setData(await fetchBooking(token));
    } catch {
      /* keep what we have */
    }
  }, [token]);

  // A failure has to be announced, not just drawn — the button that caused it
  // may be well below the fold on a phone.
  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const submit = async () => {
    if (!selected || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const result = moving
        ? await rescheduleBooking(token, selected.startsAt)
        : await confirmBooking(token, selected.startsAt);
      // Refreshed BEFORE the confirmation is shown, not after. The other way
      // round, the panel appears with the reschedule count it had a moment
      // ago and silently corrects itself — so a candidate who has just used
      // their last change is briefly told they have one left.
      await refresh();
      setJustBooked(result.booked);
      setMoving(false);
    } catch (failure) {
      setSubmitError(failure.message);
      // 409 means the slot went while they were deciding, or the booking
      // rules moved. Either way the list they are looking at is stale — so
      // fetch a fresh one rather than let them try the same dead slot again.
      if (failure.status === 409) {
        setSelected(null);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const doCancel = async () => {
    setSubmitting(true);
    try {
      await cancelBooking(token);
      setConfirmingCancel(false);
      setCancelled(true);
    } catch (failure) {
      setConfirmingCancel(false);
      setSubmitError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── The states that end the page ──────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <Card className="mx-auto my-12 max-w-form text-center" aria-busy="true">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-lav motion-reduce:animate-none" />
          <div className="mx-auto mt-5 h-5 w-56 animate-pulse rounded bg-lav-soft motion-reduce:animate-none" />
          <div className="mx-auto mt-3 h-4 w-72 animate-pulse rounded bg-lav-soft motion-reduce:animate-none" />
          <p className="sr-only" role="status">
            Loading your interview times
          </p>
        </Card>
      </AppShell>
    );
  }

  if (deadLink) {
    const copy = DEAD_LINK[deadLink];
    return (
      <Notice icon={copy.icon} tone="warn" title={copy.title}>
        <p>{copy.body}</p>
      </Notice>
    );
  }

  if (cancelled) {
    return (
      <Notice icon="check" title="Your interview has been cancelled">
        <p>Thanks for letting us know. If you would like to rebook, reply to your invitation email.</p>
      </Notice>
    );
  }

  if (loadError) {
    return (
      <Notice icon="alert" tone="warn" title="We could not load your booking page">
        <p>{loadError}</p>
        <p className="mt-5">
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </p>
      </Notice>
    );
  }

  const { interview, days = [] } = data ?? {};
  const role = roleFromApiKey(interview?.role);
  const tzLabel = role?.tzLabel ?? 'local time';

  // What the server knows, or what we have just done. Both shapes match.
  const booked = justBooked ?? interview?.booked;
  const showConfirmation = booked && !moving;

  if (showConfirmation) {
    const movesLeft = (interview.maxReschedules ?? 0) - (interview.rescheduleCount ?? 0);
    // The server enforces this too; showing the button when it would be
    // refused is just an invitation to be told no.
    const tooLate = new Date(booked.startsAt).getTime() - Date.now() < 2 * 3_600_000;

    return (
      <AppShell>
        <Card className="mx-auto my-12 max-w-form text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-cta text-white"
          >
            <Icon name="check" size={28} strokeWidth={2.6} />
          </span>
          <h1 className="text-display-md font-extrabold text-ink">
            {justBooked ? 'Your interview is booked' : 'Your interview is confirmed'}
          </h1>

          <p role="status" className="mt-3 text-[1rem] text-body">
            <b className="font-semibold">{booked.localDay}</b> at{' '}
            <b className="font-semibold">{booked.localTime}</b> {tzLabel}
            <span className="block text-[0.88rem] text-muted">({booked.ukTime} UK time)</span>
          </p>

          <div className="mt-6 grid gap-2 rounded-panel bg-lav-soft p-4 text-left text-[0.88rem] text-violet-deep">
            <p className="flex items-center gap-2">
              <Icon name="user" size={16} /> With {interview.interviewerName}
            </p>
            <p className="flex items-center gap-2">
              <Icon name="clock" size={16} /> 30 minutes
            </p>
            {booked.meetLink ? (
              <p className="flex items-center gap-2">
                <Icon name="video" size={16} />
                <a href={booked.meetLink} className="font-semibold underline">
                  Join on Google Meet
                </a>
              </p>
            ) : (
              // Stage 7 creates the calendar event and the Meet link. Until it
              // does, promising an invite that nothing sends would be a lie
              // the candidate only discovers on the day.
              <p className="flex items-center gap-2">
                <Icon name="video" size={16} /> We’ll email you the video link before your interview
              </p>
            )}
          </div>

          {submitError ? (
            <p role="alert" className="mt-4 text-[0.86rem] font-medium text-danger">
              {submitError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {movesLeft > 0 && !tooLate ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setMoving(true);
                  setJustBooked(null);
                  setSubmitError('');
                  load();
                }}
              >
                <Icon name="calendar" size={15} />
                Change my time
              </Button>
            ) : null}
            <Button variant="danger" onClick={() => setConfirmingCancel(true)}>
              Cancel interview
            </Button>
          </div>

          <p className="mt-4 text-[0.8rem] leading-relaxed text-muted">
            {tooLate
              ? 'Interviews can only be changed up to 2 hours beforehand. Reply to your invitation email if you need to move it.'
              : movesLeft > 0
                ? `You can change your time ${movesLeft === 1 ? 'once more' : `${movesLeft} more times`}, up to 2 hours beforehand.`
                : 'You have already changed your time twice. Reply to your invitation email if you need to move it again.'}
          </p>
        </Card>

        {confirmingCancel ? (
          <Modal
            titleId="cancel-title"
            className="max-w-md"
            onClose={() => (submitting ? null : setConfirmingCancel(false))}
          >
            <h2 id="cancel-title" className="text-[1.15rem] font-bold text-ink">
              Cancel your interview?
            </h2>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
              This releases your {booked.localDay} slot at {booked.localTime}. You will need to
              email us to rebook.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmingCancel(false)}
                disabled={submitting}
              >
                Keep it
              </Button>
              <Button variant="danger" onClick={doCancel} disabled={submitting}>
                {submitting ? 'Cancelling…' : 'Yes, cancel'}
              </Button>
            </div>
          </Modal>
        ) : null}
      </AppShell>
    );
  }

  // ── Picking a time ────────────────────────────────────────────────────────

  if (days.length === 0) {
    return (
      <Notice icon="calendar" tone="warn" title="No times are available right now">
        <p>
          Every slot in the next two weeks has been taken. Reply to your invitation email and we
          will find you a time.
        </p>
      </Notice>
    );
  }

  const day = days[Math.min(dayIndex, days.length - 1)];

  /**
   * "lunch (12:30-13:15 UK) and " — or nothing at all.
   *
   * Read from the rule the slots were built from, so it cannot say one thing
   * while the buttons below it say another. It used to be prose naming a fixed
   * 11:30-12:30, which stopped being true the moment lunch moved.
   *
   * The times are the interviewer's wall clock, not the candidate's, so the
   * zone is named. Anything without both ends is skipped rather than rendered
   * as a half-window.
   */
  const zoneLabel = data.rulesTimezone === 'Europe/London' ? 'UK' : (data.rulesTimezone ?? '');
  const blockedNote = (data.blocks ?? [])
    .filter((b) => b?.start && b?.end)
    .map((b) => `${(b.label ?? 'a break').toLowerCase()} (${b.start}–${b.end}${zoneLabel ? ' ' + zoneLabel : ''})`)
    .reduce((acc, text, i, all) => acc + text + (i < all.length - 1 ? ', ' : ' and '), '');


  // "Thu 10 Sept" -> weekday and date number, for the day tiles. Parsed from
  // the label the server already formatted in the CANDIDATE's timezone rather
  // than from `date`, which is the interviewer's day and can be a day out.
  const splitLabel = (label) => {
    const [weekday = '', number = ''] = String(label ?? '').split(' ');
    return { weekday, number };
  };

  return (
    <AppShell navSubtitle={COMPANY.parentEntity}>
      {/* Band and card, as the prototype has it: the card lifts out of the
          gradient rather than sitting below it. */}
      <section className="bg-brand px-6 pb-16 pt-7 text-white">
        <div className="mx-auto max-w-[820px]">
          <p className="text-[0.8rem] font-semibold text-white/65">Interview booking</p>
          <h1 className="mt-1.5 text-[1.55rem] font-black leading-tight tracking-[-0.03em] sm:text-[1.875rem]">
            {moving ? 'Pick a new time' : 'Choose a time that suits you'}
          </h1>
          <p className="mt-3 max-w-[560px] text-[0.95rem] leading-relaxed text-white/80">
            {/* Their own name, because it is how somebody knows at a glance
                that they opened their link and not somebody else's. */}
            {interview?.firstName ? <>Hi {interview.firstName} — p</> : <>P</>}ick any slot below.
            Times are shown in your own timezone ({tzLabel}) with UK time underneath, so there is
            nothing to work out.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-10 mb-8 max-w-[820px] px-4">
        <Card className="px-6 py-[26px]">
          {submitError ? (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mb-4 rounded-panel border border-danger/30 bg-red-50 px-4 py-3 text-[0.88rem] font-medium text-danger"
            >
              {submitError}
            </p>
          ) : null}

          {/* Who they are meeting */}
          <div className="mb-[22px] flex items-center gap-3.5 border-b border-line pb-5">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-[14px] bg-lav text-[1rem] font-extrabold text-violet-deep"
            >
              {initialsOf(interview?.interviewerName)}
            </span>
            <div className="min-w-0">
              <b className="block text-[1rem] font-bold tracking-tight text-ink">
                {interview?.interviewerName}
              </b>
              <span className="block text-[0.84rem] text-muted">
                {role?.title ?? 'Interview'} · {COMPANY.name}
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {['30 minutes', 'Video call', `Times shown in ${tzLabel}`].map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-full border border-lav bg-lav-soft px-2.5 py-[5px] text-[0.78rem] font-semibold text-ink"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Pick a day */}
          <h2 className="text-[1.06rem] font-extrabold tracking-tight text-ink">Pick a day</h2>
          <p className="mb-4 mt-1 text-[0.84rem] text-muted">Interviews run Monday to Friday.</p>

          <div
            className="mb-[22px] grid grid-cols-3 gap-2 sm:grid-cols-5"
            role="group"
            aria-label="Choose a day"
          >
            {days.map((d, i) => {
              const { weekday, number } = splitLabel(d.localLabel);
              const chosen = i === dayIndex;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setDayIndex(i);
                    setSelected(null);
                  }}
                  aria-pressed={chosen}
                  aria-label={`${d.localLabel}, ${d.slots.length} times free`}
                  className={cn(
                    'rounded-[12px] border-[1.5px] px-1.5 py-3 text-center transition-colors',
                    chosen
                      ? 'border-violet bg-violet text-white'
                      : 'border-line bg-white hover:border-violet',
                  )}
                >
                  <small
                    className={cn(
                      'block text-[0.72rem] font-semibold',
                      chosen ? 'text-white/80' : 'text-muted',
                    )}
                  >
                    {weekday}
                  </small>
                  <b
                    className={cn(
                      'my-[3px] block text-[1.19rem] font-extrabold',
                      chosen ? 'text-white' : 'text-ink',
                    )}
                  >
                    {number}
                  </b>
                  <i
                    className={cn(
                      'block text-[0.69rem] font-semibold not-italic',
                      chosen ? 'text-white/80' : 'text-ok',
                    )}
                  >
                    {d.slots.length} free
                  </i>
                </button>
              );
            })}
          </div>

          {/* Pick a time */}
          <h2 className="text-[1.06rem] font-extrabold tracking-tight text-ink">Pick a time</h2>
          <p className="mb-4 mt-1 text-[0.84rem] text-muted">
            Only free times are shown — {blockedNote}evenings are not offered.
          </p>

          <div
            className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]"
            role="group"
            aria-label="Choose a time"
          >
            {day.slots.map((slot) => {
              const isSelected = selected?.startsAt === slot.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setSelected(slot)}
                  aria-pressed={isSelected}
                  aria-label={`${slot.localTime} your time, ${slot.ukTime} UK time`}
                  className={cn(
                    'rounded-control border-[1.5px] px-2 py-[11px] text-center leading-[1.35] transition-colors',
                    isSelected
                      ? 'border-violet bg-violet text-white'
                      : 'border-line bg-white text-ink hover:border-violet',
                  )}
                >
                  <span className="block text-[0.875rem] font-semibold tabular">
                    {slot.localTime}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-[0.69rem] tabular',
                      isSelected ? 'text-white/75' : 'text-muted',
                    )}
                  >
                    {slot.ukTime} UK
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* The prototype's sticky confirm bar. It follows the page, so the
          action stays reachable without scrolling back up a long list. */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3.5 border-t border-line bg-white px-6 py-4 shadow-[0_-8px_24px_-14px_rgba(46,16,101,0.3)]">
        <p className="text-[0.9rem] text-muted" role="status">
          {selected ? (
            <>
              <b className="font-semibold text-ink">{day.localLabel}</b> at{' '}
              <b className="font-semibold text-ink">{selected.localTime}</b> {tzLabel}
              <span> · {selected.ukTime} UK</span>
            </>
          ) : (
            'No time selected yet'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {moving ? (
            <Button
              variant="secondary"
              onClick={() => {
                setMoving(false);
                setSubmitError('');
              }}
            >
              Keep my current time
            </Button>
          ) : null}
          <Button
            size="lg"
            disabled={!selected || submitting}
            aria-busy={submitting || undefined}
            onClick={submit}
          >
            {submitting ? (moving ? 'Moving…' : 'Booking…') : 'Confirm interview'}
          </Button>
        </div>
      </div>

      <p className="mx-auto max-w-[820px] px-6 pb-10 pt-5 text-center text-[0.8rem] leading-relaxed text-muted">
        Need a different time, or something come up? Reply to your invitation email and we will
        rearrange.
      </p>
    </AppShell>
  );
}

export default BookingPage;
