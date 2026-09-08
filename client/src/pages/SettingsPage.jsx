import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { AdminSignIn } from '@/features/dashboard/AdminSignIn';
import { PasswordPanel, TeamPanel } from '@/features/dashboard/TeamPanel';
import {
  adminAddBlackout,
  adminRemoveBlackout,
  adminSaveAvailability,
  adminSaveInterviewer,
  adminSetFlag,
  adminSetRetention,
  adminSettings,
  adminSignOut,
  getAdminToken,
} from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';

/**
 * Availability, time off, and the switches that decide who can reach the
 * portal at all. Spec §8.3 and §2.
 *
 * Until this existed, the rules that decide which slots a candidate is offered
 * could only be changed by running SQL against production — which is not a
 * thing anyone should have to do to move lunch by half an hour.
 */

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  // 7, not 0: the database uses ISO numbering, where Sunday is 7. Stored
  // as 0 it would be a day nothing ever matches, and Sunday would quietly
  // never be offered.
  { value: 7, label: 'Sun' },
];

const FLAG_COPY = {
  recruitment_portal: {
    title: 'Application pages',
    on: 'Candidates can see the roles and apply.',
    off: 'The application form is closed. Nobody outside the firm can apply.',
  },
  recruitment_booking: {
    title: 'Interview booking',
    on: 'Accepted candidates can pick their own slot.',
    off: 'Booking links will not open. Arrange times by email instead.',
  },
  recruitment_alerts: {
    title: 'Emails to candidates',
    on: 'Emails are sent as things happen.',
    off: 'No email leaves the system. Applications and decisions are still recorded, and each unsent email is listed against the applicant so you can follow up by hand.',
  },
};

/** A switch with its consequence spelled out, rather than a bare toggle. */
function FlagRow({ name, enabled, busy, onChange }) {
  const copy = FLAG_COPY[name] ?? { title: name, on: '', off: '' };
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <b className="text-[0.95rem] font-semibold text-ink">{copy.title}</b>
        <p
          className={cn(
            'mt-0.5 text-[0.85rem] leading-relaxed',
            enabled ? 'text-muted' : 'text-warn',
          )}
        >
          {enabled ? copy.on : copy.off}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={copy.title}
        disabled={busy}
        onClick={() => onChange(name, !enabled)}
        className={cn(
          'relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-60',
          enabled ? 'bg-emerald-600' : 'bg-slate-300',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  usePageMeta({
    title: 'Settings — Fast Action Claims',
    description: 'Interview availability and portal settings.',
    robots: 'noindex, nofollow',
  });

  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminToken()));
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState('');

  const [blackout, setBlackout] = useState({ from: '', to: '', reason: '' });
  const [months, setMonths] = useState('');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [clashes, setClashes] = useState(null);

  const signOut = useCallback(() => {
    adminSignOut();
    setSignedIn(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminSettings();
      setData(result);
      setForm({
        dayStart: (result.interviewer.day_start ?? '09:00').slice(0, 5),
        dayEnd: (result.interviewer.day_end ?? '17:00').slice(0, 5),
        weekdays: result.interviewer.weekdays ?? [1, 2, 3, 4, 5],
        slotMinutes: result.interviewer.slot_minutes ?? 30,
        minNoticeHours: result.interviewer.min_notice_hours ?? 24,
        maxDaysAhead: result.interviewer.max_days_ahead ?? 14,
        blocks: result.interviewer.blocks ?? [],
      });
      setMonths(String(result.retention?.months ?? 0));
      setInterviewerEmail(result.interviewer.email ?? '');
    } catch (failure) {
      if (failure.status === 401) signOut();
      else setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  const announce = (message) => {
    setSaved(message);
    setTimeout(() => setSaved(''), 4000);
  };

  const saveInterviewerEmail = async () => {
    setBusy('interviewer');
    setError('');
    try {
      await adminSaveInterviewer(interviewerEmail.trim());
      announce('Saved. Bookings will be sent to that address.');
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const saveAvailability = async () => {
    setBusy('availability');
    setError('');
    try {
      await adminSaveAvailability({ interviewerId: data.interviewer.id, ...form });
      announce('Availability saved. New slots take effect immediately.');
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const addBlackout = async () => {
    setBusy('blackout');
    setError('');
    setClashes(null);
    try {
      // A date with no time means the whole day — which is what someone typing
      // a holiday into a date box means, and midnight-to-midnight is not.
      const result = await adminAddBlackout({
        interviewerId: data.interviewer.id,
        startsAt: `${blackout.from}T00:00:00`,
        endsAt: `${blackout.to || blackout.from}T23:59:59`,
        reason: blackout.reason,
      });
      setBlackout({ from: '', to: '', reason: '' });
      if (result.clashes?.length) setClashes(result.clashes);
      else announce('Time off saved. Those slots are no longer offered.');
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const removeBlackout = async (id) => {
    setBusy(`remove-${id}`);
    try {
      await adminRemoveBlackout(id, data.interviewer.id);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const saveRetention = async () => {
    setBusy('retention');
    setError('');
    try {
      const result = await adminSetRetention(Number(months));
      announce(
        result.months === 0
          ? 'CV deletion is switched off. Nothing will be deleted.'
          : `CVs of declined applicants will be deleted after ${result.months} months.`,
      );
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const toggleFlag = async (name, enabled) => {
    setBusy(name);
    setError('');
    try {
      await adminSetFlag(name, enabled);
      await load();
      announce(`${FLAG_COPY[name]?.title ?? name} turned ${enabled ? 'on' : 'off'}.`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  if (!signedIn) return <AdminSignIn onSignedIn={() => setSignedIn(true)} />;

  // Everything that changes how the portal RUNS is administrator-only on the
  // server. This only decides what to offer; it is not the guard.
  const isAdmin = data?.you?.role === 'administrator';

  return (
    <AdminShell
      current="settings"
      title="Settings"
      subtitle="When interviews can be booked, when you are unavailable, and who can reach the portal."
      onSignOut={signOut}
    >
      <div className="mx-auto max-w-3xl">
        {saved ? (
          <p
            role="status"
            className="mb-4 rounded-panel border border-emerald-300 bg-emerald-50 px-4 py-3 text-[0.88rem] font-medium text-emerald-900"
          >
            {saved}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-panel border border-danger/30 bg-red-50 px-4 py-3 text-[0.88rem] font-medium text-danger"
          >
            {error}
          </p>
        ) : null}

        {loading || !form ? (
          <Card aria-busy="true">
            <div className="h-5 w-48 animate-pulse rounded bg-lav-soft motion-reduce:animate-none" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-lav-soft motion-reduce:animate-none" />
            <p className="sr-only" role="status">
              Loading settings
            </p>
          </Card>
        ) : (
          <div className="grid gap-5">
            {/* ── Who ─────────────────────────────────────────────────── */}
            <Card>
              <h2 className="text-[1.1rem] font-bold text-ink">Interviewer</h2>
              <p className="mt-1 text-[0.9rem] text-muted">
                <b className="font-semibold text-ink">{data.interviewer.full_name}</b>
              </p>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-muted">
                Slots are worked out in{' '}
                <b className="font-semibold">{form.timezone ?? data.interviewer.timezone}</b> and
                shown to each candidate in their own timezone alongside UK time.
              </p>

              {/* The address now has a job: every booking is sent to it. It is
                  editable rather than seeded because the seeded one was a
                  placeholder, and a booking sent to an address nobody reads is
                  the same as no booking email at all. */}
              {isAdmin ? (
                <div className="mt-4 border-t border-line pt-4">
                  <Field
                    label="Where to send bookings"
                    hint="The interviewer is emailed whenever a candidate books or moves a slot."
                    required
                  >
                    {(props) => (
                      <TextInput
                        {...props}
                        type="email"
                        value={interviewerEmail}
                        placeholder="name@fastactionclaims.co.uk"
                        autoComplete="off"
                        onChange={(e) => setInterviewerEmail(e.target.value)}
                      />
                    )}
                  </Field>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      onClick={saveInterviewerEmail}
                      disabled={
                        busy === 'interviewer' ||
                        !interviewerEmail.trim() ||
                        interviewerEmail.trim() === (data.interviewer.email ?? '')
                      }
                    >
                      {busy === 'interviewer' ? 'Saving...' : 'Save address'}
                    </Button>
                    {!data.interviewer.email ? (
                      <span className="text-[0.82rem] text-warn">
                        No address set, so nobody is told when a candidate books.
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Card>

            {isAdmin ? (
              <>
                {/* ── When ────────────────────────────────────────────────── */}
                <Card>
                  <h2 className="text-[1.1rem] font-bold text-ink">Interview hours</h2>
                  <p className="mt-1 text-[0.86rem] text-muted">
                    These decide every slot a candidate is offered.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Day starts" required>
                      {(props) => (
                        <TextInput
                          {...props}
                          type="time"
                          value={form.dayStart}
                          onChange={(e) => setForm((f) => ({ ...f, dayStart: e.target.value }))}
                        />
                      )}
                    </Field>
                    <Field
                      label="Day ends"
                      hint="The last interview must finish by this time."
                      required
                    >
                      {(props) => (
                        <TextInput
                          {...props}
                          type="time"
                          value={form.dayEnd}
                          onChange={(e) => setForm((f) => ({ ...f, dayEnd: e.target.value }))}
                        />
                      )}
                    </Field>
                  </div>

                  <fieldset className="mt-5">
                    <legend className="mb-2 text-[0.82rem] font-semibold text-ink">
                      Working days
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((day) => {
                        const on = form.weekdays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                weekdays: on
                                  ? f.weekdays.filter((d) => d !== day.value)
                                  : [...f.weekdays, day.value].sort(),
                              }))
                            }
                            className={cn(
                              'rounded-control px-3.5 py-2 text-[0.85rem] font-semibold transition-colors',
                              on
                                ? 'bg-ink text-white'
                                : 'border border-line bg-white text-ink hover:border-violet',
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <Field label="Interview length" required>
                      {(props) => (
                        <Select
                          {...props}
                          value={form.slotMinutes}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, slotMinutes: Number(e.target.value) }))
                          }
                        >
                          {[15, 20, 30, 45, 60].map((m) => (
                            <option key={m} value={m}>
                              {m} minutes
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="Shortest notice" hint="Hours" required>
                      {(props) => (
                        <TextInput
                          {...props}
                          type="number"
                          min="0"
                          max="168"
                          value={form.minNoticeHours}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, minNoticeHours: e.target.value }))
                          }
                        />
                      )}
                    </Field>
                    <Field label="Book up to" hint="Days ahead" required>
                      {(props) => (
                        <TextInput
                          {...props}
                          type="number"
                          min="1"
                          max="90"
                          value={form.maxDaysAhead}
                          onChange={(e) => setForm((f) => ({ ...f, maxDaysAhead: e.target.value }))}
                        />
                      )}
                    </Field>
                  </div>

                  {form.blocks?.length ? (
                    <p className="mt-4 text-[0.84rem] text-muted">
                      Blocked every day:{' '}
                      {form.blocks
                        .map((b) => `${b.label ?? 'Blocked'} ${b.start}–${b.end}`)
                        .join(', ')}
                      .
                    </p>
                  ) : null}

                  <div className="mt-6 border-t border-line pt-5">
                    <Button onClick={saveAvailability} disabled={busy === 'availability'}>
                      {busy === 'availability' ? 'Saving…' : 'Save interview hours'}
                    </Button>
                  </div>
                </Card>

                {/* ── Time off ────────────────────────────────────────────── */}
                <Card>
                  <h2 className="text-[1.1rem] font-bold text-ink">Time off</h2>
                  <p className="mt-1 text-[0.86rem] leading-relaxed text-muted">
                    Days you are not available. Candidates simply will not see those slots — they
                    are never told why.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr]">
                    <Field label="From" required>
                      {(props) => (
                        <TextInput
                          {...props}
                          type="date"
                          value={blackout.from}
                          onChange={(e) => setBlackout((b) => ({ ...b, from: e.target.value }))}
                        />
                      )}
                    </Field>
                    <Field label="To" hint="Leave blank for one day">
                      {(props) => (
                        <TextInput
                          {...props}
                          type="date"
                          value={blackout.to}
                          onChange={(e) => setBlackout((b) => ({ ...b, to: e.target.value }))}
                        />
                      )}
                    </Field>
                    <Field label="Reason" hint="Only you see this">
                      {(props) => (
                        <TextInput
                          {...props}
                          value={blackout.reason}
                          placeholder="Annual leave"
                          onChange={(e) => setBlackout((b) => ({ ...b, reason: e.target.value }))}
                        />
                      )}
                    </Field>
                  </div>

                  <Button
                    className="mt-2"
                    variant="secondary"
                    onClick={addBlackout}
                    disabled={!blackout.from || busy === 'blackout'}
                  >
                    <Icon name="plus" size={15} />
                    {busy === 'blackout' ? 'Saving…' : 'Add time off'}
                  </Button>

                  {/* Booked interviews inside the period are reported, never
                  cancelled — being away is not the same as calling them off. */}
                  {clashes?.length ? (
                    <div
                      role="alert"
                      className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-4"
                    >
                      <p className="text-[0.88rem] font-semibold text-amber-900">
                        That period already has {clashes.length} booked interview
                        {clashes.length === 1 ? '' : 's'}.
                      </p>
                      <ul className="mt-2 grid gap-1">
                        {clashes.map((c) => (
                          <li key={c.id} className="text-[0.85rem] text-amber-900">
                            {c.full_name} — {formatDateTime(c.starts_at)}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[0.82rem] italic text-amber-800">
                        They have not been cancelled. Contact them if you need to move those.
                      </p>
                    </div>
                  ) : null}

                  {data.blackouts?.length ? (
                    <ul className="mt-5 grid gap-2 border-t border-line pt-4">
                      {data.blackouts.map((b) => (
                        <li
                          key={b.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="text-[0.88rem] text-ink">
                            {formatDateTime(b.starts_at)} → {formatDateTime(b.ends_at)}
                            {b.reason ? <span className="text-muted"> · {b.reason}</span> : null}
                          </span>
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => removeBlackout(b.id)}
                            disabled={busy === `remove-${b.id}`}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 border-t border-line pt-4 text-[0.85rem] text-muted">
                      No time off recorded.
                    </p>
                  )}
                </Card>
              </>
            ) : null}

            <PasswordPanel you={data.you} onError={setError} />

            {isAdmin ? <TeamPanel you={data.you} onError={setError} /> : null}

            {!isAdmin ? (
              <Card>
                <h2 className="text-[1.1rem] font-bold text-ink">Interview hours and the rest</h2>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-muted">
                  Availability, time off, how long CVs are kept and what is switched on are changed
                  by an administrator. Ask one of them if something here needs to move.
                </p>
              </Card>
            ) : null}

            {isAdmin ? (
              <>
                {/* ── Retention ───────────────────────────────────────────── */}
                <Card>
                  <h2 className="text-[1.1rem] font-bold text-ink">Keeping CVs</h2>
                  <p className="mt-1 text-[0.86rem] leading-relaxed text-muted">
                    A CV is personal data belonging to someone who is not a client, so it should not
                    be kept indefinitely. Once a declined applicant passes this age, their CV file
                    is deleted automatically.
                  </p>
                  <p className="mt-2 text-[0.84rem] leading-relaxed text-muted">
                    The application itself is never deleted — the decision, the score and who made
                    it stay on record. Only the file goes.
                  </p>

                  <div className="mt-5 flex flex-wrap items-end gap-3">
                    <Field
                      label="Delete after"
                      hint="Months. 0 switches deletion off."
                      required
                      className="w-40"
                    >
                      {(props) => (
                        <TextInput
                          {...props}
                          type="number"
                          min="0"
                          max="120"
                          value={months}
                          onChange={(e) => setMonths(e.target.value)}
                        />
                      )}
                    </Field>
                    <Button
                      variant="secondary"
                      onClick={saveRetention}
                      disabled={busy === 'retention'}
                    >
                      {busy === 'retention' ? 'Saving…' : 'Save'}
                    </Button>
                  </div>

                  {Number(data.retention?.months) === 0 ? (
                    <p className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-3.5 text-[0.85rem] leading-relaxed text-amber-900">
                      Deletion is switched off, so CVs are kept indefinitely. That is a decision
                      worth making deliberately rather than by leaving this at zero.
                    </p>
                  ) : data.retention?.dueCount > 0 ? (
                    <p className="mt-4 text-[0.85rem] text-muted">
                      <b className="font-semibold text-ink">{data.retention.dueCount}</b> CV
                      {data.retention.dueCount === 1 ? ' is' : 's are'} past that age and will be
                      deleted at the next daily sweep.
                    </p>
                  ) : (
                    <p className="mt-4 text-[0.85rem] text-muted">
                      Nothing is currently due for deletion.
                    </p>
                  )}

                  <p className="mt-3 text-[0.78rem] leading-relaxed text-muted">
                    This covers declined applicants only. Nobody has set a policy for applications
                    still awaiting a decision, or for accepted candidates — worth deciding.
                  </p>
                </Card>

                {/* ── Flags ───────────────────────────────────────────────── */}
                <Card>
                  <h2 className="text-[1.1rem] font-bold text-ink">What is switched on</h2>
                  <p className="mt-1 text-[0.86rem] leading-relaxed text-muted">
                    Everything starts off, so the portal can be set up and checked before anyone
                    outside the firm can reach it. Turn each on when you are ready.
                  </p>

                  <div className="mt-4">
                    {Object.keys(FLAG_COPY).map((name) => (
                      <FlagRow
                        key={name}
                        name={name}
                        enabled={data.flags?.[name] === true}
                        busy={busy === name}
                        onChange={toggleFlag}
                      />
                    ))}
                  </div>

                  {data.flags?.recruitment_alerts && data.mailMode === 'file' ? (
                    <p className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-3.5 text-[0.85rem] leading-relaxed text-amber-900">
                      Emails are switched on, but no mailbox is set up — they are being written to a
                      file on the server rather than sent. Nothing is reaching candidates yet.
                    </p>
                  ) : null}
                </Card>
              </>
            ) : null}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

export default SettingsPage;
