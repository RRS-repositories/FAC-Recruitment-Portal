import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminShell } from '@/components/layout/AdminShell';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput } from '@/components/ui/Field';
import { AdminSignIn } from '@/features/dashboard/AdminSignIn';
import {
  adminAddBlackout,
  adminCalendar,
  adminRemoveBlackout,
  adminSignOut,
  getAdminToken,
} from '@/lib/api';
import { roleFromApiKey } from '@/lib/normalise';
import { formatTimeIn } from '@/lib/format';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';

/**
 * The week, drawn.
 *
 * Everything here was already true before the page existed — the bookings, the
 * blocked time, the hours. This adds no rule and decides nothing; it is the
 * same information the applicant list and the settings screen hold, arranged
 * so a week can be read at a glance instead of reconstructed from rows.
 *
 * The grid itself comes from the server. Which instants make up 09:00–17:00 in
 * London across a clock change is arithmetic that already exists there, in the
 * same file that builds the candidate's slot list; doing it again here would
 * be a second chance to get the last Sunday in October wrong.
 */

const DAY_NAMES = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The zones worth offering: the interviewer's working day, and the two the
 * candidates live in. Not a list of every timezone — this answers "what time
 * is that for them", and three options answer it.
 *
 * The grid never moves. Slots are absolute instants, so switching zone
 * relabels the same columns rather than reshuffling the week.
 */
const ZONES = [
  { id: 'Europe/London', label: 'UK', note: "the interviewer's day" },
  { id: 'Asia/Kolkata', label: 'India', note: 'IST' },
  { id: 'Africa/Johannesburg', label: 'South Africa', note: 'SAST' },
];

const ZONE_KEY = 'fac.admin.calendarZone';

/** What each state looks like, and what it means. One place, so the key on the
 *  page and the cells themselves can never disagree. */
const STATE = {
  booked: {
    label: 'Interview booked',
    cell: 'bg-violet text-white border-violet-deep',
    dot: 'bg-violet',
  },
  blocked: {
    label: 'Blocked',
    cell: 'bg-amber-100 text-amber-900 border-amber-300 [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(180,83,9,0.12)_5px,rgba(180,83,9,0.12)_10px)]',
    dot: 'bg-amber-400',
  },
  free: {
    label: 'Free to book',
    cell: 'bg-white text-ink border-line hover:border-violet hover:bg-lav-soft',
    dot: 'bg-white ring-1 ring-line',
  },
  past: {
    label: 'Too soon to book',
    cell: 'bg-slate-100 text-slate-400 border-line',
    dot: 'bg-slate-100 ring-1 ring-slate-300',
  },
  break: { label: 'Lunch', cell: 'bg-lav-soft text-muted border-lav', dot: 'bg-lav' },
  closed: {
    label: 'Not a working day',
    cell: 'bg-slate-200/70 text-slate-400 border-line',
    dot: 'bg-slate-300',
  },
};

/** Monday of the week containing a date, as YYYY-MM-DD. */
function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return iso(d);
}

const iso = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const shift = (isoDate, days) => {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
};

const prettyDate = (isoDate) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(`${isoDate}T12:00:00`),
  );

export function CalendarPage() {
  usePageMeta({
    title: 'Calendar — Fast Action Claims',
    description: 'Interviews and blocked time, week by week.',
    robots: 'noindex, nofollow',
  });

  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminToken()));
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Remembered, because somebody who works in one zone will want it every
  // time rather than switching on every visit.
  const [zone, setZone] = useState(() => {
    try {
      return localStorage.getItem(ZONE_KEY) || 'Europe/London';
    } catch {
      return 'Europe/London';
    }
  });

  const chooseZone = (id) => {
    setZone(id);
    try {
      localStorage.setItem(ZONE_KEY, id);
    } catch {
      /* the preference simply will not stick */
    }
  };

  // What the manager clicked: a booked slot to look at, or a free one to hold.
  const [chosen, setChosen] = useState(null);
  const [reason, setReason] = useState('');

  const signOut = useCallback(() => {
    adminSignOut();
    setSignedIn(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminCalendar(weekStart, shift(weekStart, 6)));
    } catch (failure) {
      if (failure.status === 401) signOut();
      else setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [weekStart, signOut]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  // Every day has the same slots at the same times, so one column of times
  // labels the whole grid rather than repeating on each day.
  const times = useMemo(
    () => data?.days?.[0]?.slots.map((s) => formatTimeIn(s.startsAt, zone)) ?? [],
    [data, zone],
  );

  const totals = useMemo(() => {
    const days = data?.days ?? [];
    return {
      booked: days.reduce((n, d) => n + d.booked, 0),
      blocked: days.reduce((n, d) => n + d.blocked, 0),
      free: days.reduce((n, d) => n + d.free, 0),
    };
  }, [data]);

  const blockSlot = async () => {
    setBusy(true);
    setError('');
    try {
      await adminAddBlackout({
        interviewerId: data.interviewerId,
        startsAt: chosen.slot.startsAt,
        endsAt: chosen.slot.endsAt,
        reason: reason.trim() || 'Blocked from the calendar',
      });
      setChosen(null);
      setReason('');
      await load();
    } catch (failure) {
      setError(failure.message);
      setChosen(null);
    } finally {
      setBusy(false);
    }
  };

  const unblockSlot = async () => {
    setBusy(true);
    setError('');
    try {
      await adminRemoveBlackout(chosen.slot.blackoutId, data.interviewerId);
      setChosen(null);
      await load();
    } catch (failure) {
      setError(failure.message);
      setChosen(null);
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) return <AdminSignIn onSignedIn={() => setSignedIn(true)} />;

  const thisWeek = weekStart === mondayOf(new Date());

  return (
    <AdminShell
      current="calendar"
      title="Calendar"
      subtitle={
        data
          ? `Interview hours ${data.dayStart?.slice(0, 5)}–${data.dayEnd?.slice(0, 5)} ${data.timezone.replace('_', ' ')}`
          : 'Interviews and blocked time, week by week'
      }
      onSignOut={signOut}
      loading={loading && !data}
    >
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-panel border border-danger/30 bg-red-50 px-4 py-3 text-[0.88rem] font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          {/* What the week amounts to, before the grid of it. */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Beside the week they move, and out of the top bar where they
                  crowded the account menu off a 320px screen. */}
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Previous week"
                  onClick={() => setWeekStart(shift(weekStart, -7))}
                >
                  <Icon name="chevronLeft" size={15} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setWeekStart(mondayOf(new Date()))}
                  disabled={thisWeek}
                >
                  Today
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Next week"
                  onClick={() => setWeekStart(shift(weekStart, 7))}
                >
                  <Icon name="chevronRight" size={15} />
                </Button>
              </div>
              <h2 className="text-[1.05rem] font-bold text-ink">
                {prettyDate(weekStart)} &ndash; {prettyDate(shift(weekStart, 6))}
                {thisWeek ? (
                  <span className="ml-2 text-[0.8rem] font-medium text-violet-deep">This week</span>
                ) : null}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="Show times in"
              >
                <span className="mr-1 text-[0.78rem] text-muted">Times in</span>
                {ZONES.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => chooseZone(z.id)}
                    aria-pressed={zone === z.id}
                    title={z.note}
                    className={cn(
                      'rounded-control px-2.5 py-1.5 text-[0.8rem] font-semibold transition-colors',
                      zone === z.id
                        ? 'bg-ink text-white'
                        : 'border border-line bg-white text-ink hover:border-violet',
                    )}
                  >
                    {z.label}
                  </button>
                ))}
              </div>

              <p className="text-[0.84rem] text-muted" role="status">
                <b className="font-semibold text-ink">{totals.booked}</b> booked ·{' '}
                <b className="font-semibold text-ink">{totals.free}</b> still free
                {totals.blocked ? (
                  <>
                    {' '}
                    · <b className="font-semibold text-ink">{totals.blocked}</b> blocked
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {/* The grid scrolls sideways rather than squeezing seven days into a
              phone — a week compressed to illegibility is not a week. */}
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[46rem]">
                <div
                  className="grid border-b border-line bg-lav-soft/60"
                  style={{ gridTemplateColumns: '4.5rem repeat(7, minmax(0, 1fr))' }}
                >
                  <div aria-hidden="true" />
                  {data.days.map((day) => {
                    const isToday = day.date === iso(new Date());
                    return (
                      <div
                        key={day.date}
                        className={cn(
                          'border-l border-line px-2 py-2.5 text-center',
                          !day.working && 'bg-slate-50',
                        )}
                      >
                        <p
                          className={cn(
                            'text-[0.72rem] font-semibold uppercase tracking-wide',
                            isToday ? 'text-violet-deep' : 'text-muted',
                          )}
                        >
                          {SHORT[day.weekday]}
                        </p>
                        <p
                          className={cn(
                            'text-[0.95rem] font-bold',
                            isToday ? 'text-violet-deep' : 'text-ink',
                          )}
                        >
                          {Number(day.date.slice(-2))}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {times.map((time, row) => (
                  <div
                    key={time}
                    className="grid border-b border-line last:border-0"
                    style={{ gridTemplateColumns: '4.5rem repeat(7, minmax(0, 1fr))' }}
                  >
                    <div className="px-2 py-1.5 text-right text-[0.72rem] text-muted tabular">
                      {time}
                    </div>

                    {data.days.map((day) => {
                      const slot = day.slots[row];
                      if (!slot) return <div key={day.date} className="border-l border-line" />;

                      const look = STATE[slot.state] ?? STATE.free;
                      const clickable =
                        slot.state === 'free' ||
                        slot.state === 'blocked' ||
                        slot.state === 'booked';

                      const label =
                        slot.state === 'booked'
                          ? `Interview with ${slot.interview.fullName}, ${SHORT[day.weekday]} ${time}`
                          : `${look.label}, ${SHORT[day.weekday]} ${time}`;

                      return (
                        <div key={day.date} className="border-l border-line p-0.5">
                          {clickable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReason('');
                                setChosen({ slot, day });
                              }}
                              aria-label={label}
                              className={cn(
                                'h-full min-h-[2.1rem] w-full rounded border px-1.5 py-1 text-left text-[0.72rem] leading-tight transition-colors',
                                look.cell,
                              )}
                            >
                              {slot.state === 'booked' ? (
                                <>
                                  <span className="block text-[0.62rem] uppercase tracking-wide text-white/70">
                                    Interview with
                                  </span>
                                  <span className="block truncate font-semibold">
                                    {slot.interview.fullName}
                                  </span>
                                </>
                              ) : null}
                            </button>
                          ) : (
                            <div
                              className={cn(
                                'h-full min-h-[2.1rem] w-full rounded border px-1.5 py-1 text-[0.68rem] leading-tight',
                                look.cell,
                              )}
                            >
                              {slot.state === 'break' && day.working ? (
                                <span className="block truncate">{slot.breakLabel}</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8rem] text-muted">
            {['booked', 'free', 'blocked', 'break', 'past', 'closed'].map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('h-3 w-3 rounded-sm', STATE[key].dot)} />
                {STATE[key].label}
              </span>
            ))}
          </div>

          <p className="mt-3 text-[0.82rem] leading-relaxed text-muted">
            Click a free slot to block it, so no candidate can take that time. Blocking is the same
            time off as on the settings screen &mdash; this is just a quicker way to say it.
          </p>
        </>
      ) : null}

      {/* One dialog, three jobs: read a booking, hold a slot, release one. */}
      {chosen ? (
        <Modal
          titleId="slot-title"
          className="max-w-md"
          onClose={() => (busy ? null : setChosen(null))}
        >
          <h2 id="slot-title" className="text-[1.15rem] font-bold text-ink">
            {DAY_NAMES[chosen.day.weekday]} {prettyDate(chosen.day.date)},{' '}
            {formatTimeIn(chosen.slot.startsAt, zone)}
          </h2>

          {chosen.slot.state === 'booked' ? (
            <>
              <p className="mt-3 text-[0.92rem] text-body">
                <b className="font-semibold text-ink">{chosen.slot.interview.fullName}</b> &mdash;{' '}
                {roleFromApiKey(chosen.slot.interview.role)?.title ?? chosen.slot.interview.role}
              </p>
              <dl className="mt-4 grid gap-2 rounded-panel bg-lav-soft p-4 text-[0.86rem]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Their local time</dt>
                  <dd className="font-semibold text-ink">{chosen.slot.interview.localTime}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Score</dt>
                  <dd className="font-semibold text-ink">{chosen.slot.interview.score}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Email</dt>
                  <dd className="truncate font-semibold text-ink">{chosen.slot.interview.email}</dd>
                </div>
              </dl>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setChosen(null)}>
                  Close
                </Button>
                <Button to="/admin">Open in applicants</Button>
              </div>
            </>
          ) : chosen.slot.state === 'blocked' ? (
            <>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-body">
                This time is blocked
                {chosen.slot.blackoutReason ? ` — ${chosen.slot.blackoutReason}` : ''}. No candidate
                can book it.
              </p>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-muted">
                Releasing it puts the whole blocked period back, not just this slot.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setChosen(null)} disabled={busy}>
                  Leave it blocked
                </Button>
                <Button onClick={unblockSlot} disabled={busy}>
                  {busy ? 'Releasing…' : 'Make it available'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-body">
                Blocking this stops any candidate booking it. Nobody is told why &mdash; the slot
                simply stops being offered.
              </p>
              <Field label="Reason" hint="Only you see this" className="mt-4">
                {(props) => (
                  <TextInput
                    {...props}
                    value={reason}
                    placeholder="Client call"
                    onChange={(e) => setReason(e.target.value)}
                  />
                )}
              </Field>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setChosen(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={blockSlot} disabled={busy}>
                  {busy ? 'Blocking…' : 'Block this time'}
                </Button>
              </div>
            </>
          )}
        </Modal>
      ) : null}
    </AdminShell>
  );
}

export default CalendarPage;
