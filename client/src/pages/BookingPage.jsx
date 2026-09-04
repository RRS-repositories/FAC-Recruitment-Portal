import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { generateSlots, MOCK_INTERVIEWER } from '@/data/mockSlots';
import { ROLES } from '@/data/roles';
import { formatDayIn, formatTimeIn } from '@/lib/format';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';

/**
 * Candidate self-service interview booking.
 *
 * Every time is shown twice — the candidate's own zone first, UK second. A
 * cross-timezone interview invitation that shows one bare time is how people
 * join an hour late, and the candidate should never have to do the arithmetic.
 *
 * `?role=` and `?state=` drive the mock: the real page reads the booking token.
 */
export function BookingPage() {
  const [params] = useSearchParams();
  const role = ROLES[params.get('role') ?? 'india'] ?? ROLES.india;
  const forcedState = params.get('state');

  usePageMeta({
    title: 'Book your interview — Fast Action Claims',
    robots: 'noindex, nofollow',
  });

  const days = useMemo(() => generateSlots(), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const candidateTz = role.timezone;
  const day = days[dayIndex];

  if (forcedState === 'expired') {
    return (
      <AppShell>
        <Card className="mx-auto my-12 max-w-form text-center">
          <span aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Icon name="clock" size={22} />
          </span>
          <h1 className="text-display-md font-extrabold text-ink">This booking link has expired</h1>
          <p className="mt-3 text-[0.95rem] text-muted">
            Booking links are valid for 14 days. Reply to your invitation email and we&rsquo;ll
            send you a new one.
          </p>
        </Card>
      </AppShell>
    );
  }

  if (booked && selected) {
    return (
      <AppShell>
        <Card className="mx-auto my-12 max-w-form text-center">
          <span aria-hidden="true" className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-cta text-white">
            <Icon name="check" size={28} strokeWidth={2.6} />
          </span>
          <h1 className="text-display-md font-extrabold text-ink">Your interview is booked</h1>
          <p className="mt-3 text-[1rem] text-body">
            <b className="font-semibold">{formatDayIn(selected.startsAt, candidateTz)}</b> at{' '}
            <b className="font-semibold">{formatTimeIn(selected.startsAt, candidateTz)}</b> {role.tzLabel}
            <span className="block text-[0.88rem] text-muted">
              ({formatTimeIn(selected.startsAt, 'Europe/London')} UK time)
            </span>
          </p>

          <div className="mt-6 grid gap-2 rounded-panel bg-lav-soft p-4 text-left text-[0.88rem] text-violet-deep">
            <p className="flex items-center gap-2">
              <Icon name="calendar" size={16} /> A calendar invite is on its way to your email
            </p>
            <p className="flex items-center gap-2">
              <Icon name="video" size={16} /> The Google Meet link is in the invite
            </p>
            <p className="flex items-center gap-2">
              <Icon name="mail" size={16} /> We&rsquo;ll remind you 24 hours and 10 minutes before
            </p>
          </div>

          <p className="mt-5 text-[0.8rem] text-muted">
            Need to change it? Use the reschedule link in your confirmation email, up to 2 hours
            before.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Card className="mx-auto my-10 max-w-2xl">
        <h1 className="text-display-md font-extrabold text-ink">Book your interview</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
          Choose a time for your 30-minute video interview on Google Meet. Times are shown in your
          local time ({role.tzLabel}), with UK time underneath.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-panel border border-lav bg-lav-soft p-3.5">
          <span aria-hidden="true" className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-cta text-[0.8rem] font-bold text-white">
            {MOCK_INTERVIEWER.initials}
          </span>
          <span>
            <b className="block text-[0.92rem] font-semibold text-ink">{MOCK_INTERVIEWER.name}</b>
            <span className="text-[0.82rem] text-muted">
              {MOCK_INTERVIEWER.title} · {role.title}
            </span>
          </span>
        </div>

        {/* Day picker */}
        <h2 className="mb-2.5 mt-7 text-[0.8rem] font-bold uppercase tracking-wide text-muted">
          Pick a day
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Choose a day">
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              onClick={() => {
                setDayIndex(i);
                setSelected(null);
              }}
              aria-pressed={i === dayIndex}
              className={cn(
                'flex-shrink-0 rounded-control border px-4 py-2.5 text-[0.85rem] font-semibold transition-colors',
                i === dayIndex
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink hover:border-violet',
              )}
            >
              {formatDayIn(d.date, candidateTz)}
            </button>
          ))}
        </div>

        {/* Slots */}
        <h2 className="mb-2.5 mt-6 text-[0.8rem] font-bold uppercase tracking-wide text-muted">
          Pick a time
        </h2>
        {day ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Choose a time">
            {day.slots.map((slot) => {
              const isSelected = selected?.startsAt === slot.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  disabled={slot.taken}
                  onClick={() => setSelected(slot)}
                  aria-pressed={isSelected}
                  aria-label={`${formatTimeIn(slot.startsAt, candidateTz)} your time, ${formatTimeIn(slot.startsAt, 'Europe/London')} UK time${slot.taken ? ', already booked' : ''}`}
                  className={cn(
                    'rounded-control border px-2 py-2.5 text-center transition-colors',
                    slot.taken
                      ? 'cursor-not-allowed border-dashed border-line bg-slate-100 text-slate-400 line-through'
                      : isSelected
                        ? 'border-violet bg-violet text-white'
                        : 'border-line bg-white text-ink hover:border-violet',
                  )}
                >
                  <span className="block text-[0.92rem] font-semibold tabular">
                    {formatTimeIn(slot.startsAt, candidateTz)}
                  </span>
                  <span className={cn('block text-[0.7rem] tabular', isSelected ? 'text-white/75' : 'text-muted')}>
                    {formatTimeIn(slot.startsAt, 'Europe/London')} UK
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[0.9rem] text-muted">No availability in the next two weeks.</p>
        )}

        <p className="mt-4 flex flex-wrap items-center gap-4 text-[0.76rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded border border-dashed border-line bg-slate-100" />
            Already booked
          </span>
          <span>Lunch (11:30–12:30 UK) and evenings are not offered.</span>
        </p>

        <div className="mt-7 border-t border-line pt-6">
          <Button
            className="w-full"
            size="lg"
            disabled={!selected || booking}
            aria-busy={booking || undefined}
            onClick={async () => {
              setBooking(true);
              await new Promise((r) => setTimeout(r, 800));
              setBooking(false);
              setBooked(true);
            }}
          >
            {booking
              ? 'Booking…'
              : selected
                ? `Confirm ${formatTimeIn(selected.startsAt, candidateTz)} ${role.tzLabel}`
                : 'Select a time to continue'}
          </Button>
          {selected ? (
            <p className="mt-3 text-center text-[0.8rem] text-muted">
              <Badge tone="neutral">30 minutes</Badge>{' '}
              <span className="ml-1">Google Meet · link sent by email</span>
            </p>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
}

export default BookingPage;
