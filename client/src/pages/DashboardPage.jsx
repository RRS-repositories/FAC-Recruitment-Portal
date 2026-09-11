import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Flag } from '@/components/ui/Flag';
import { COLUMNS, CHEVRON_WIDTH } from '@/features/dashboard/columns';
import { DECLINE_REASONS, NO_REASON, declineReason } from '@shared/declineReasons.js';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ApplicantRow } from '@/features/dashboard/ApplicantRow';
import { AdminSignIn } from '@/features/dashboard/AdminSignIn';
import { ROLES } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import {
  adminApplications,
  adminDecide,
  adminMarkAttendance,
  adminMe,
  adminReissueLink,
  adminSettings,
  adminSignOut,
  getAdminToken,
} from '@/lib/api';
import { normaliseApplicant, normaliseSummary } from '@/lib/normalise';
import { cn } from '@/lib/cn';

const STATUS_FILTERS = [
  { key: 'all', label: 'All', countKey: 'total' },
  { key: 'pending', label: 'Awaiting review', countKey: 'pending' },
  { key: 'accepted', label: 'Accepted', countKey: 'accepted' },
  { key: 'declined', label: 'Declined', countKey: 'declined' },
];

/** The counts beside those buttons, before the server has answered. */
const EMPTY_TABS = { total: 0, pending: 0, accepted: 0, declined: 0 };

const EMPTY_SUMMARY = normaliseSummary();

/**
 * One summary figure. Only the counts a manager acts on get a tile — a tile
 * for every number turns the row into decoration and hides the one that
 * matters.
 */
const STAT_TONES = {
  default: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  brand: 'text-violet-deep',
};

function Stat({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-[14px] bg-white px-5 py-[22px] shadow-stat">
      <span className="block text-[0.8rem] font-medium text-muted">{label}</span>
      <b className={cn('mt-2 block text-[1.7rem] font-black leading-none tabular', STAT_TONES[tone])}>
        {value}
      </b>
    </div>
  );
}

/** Placeholder rows, so the list has a shape before the data lands. */
function RowSkeleton() {
  return (
    <ul aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-line px-5 py-5 last:border-0"
        >
          <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-lav-soft motion-reduce:animate-none" />
          <div className="grid flex-1 gap-2">
            <div className="h-3.5 w-44 animate-pulse rounded bg-lav-soft motion-reduce:animate-none" />
            <div className="h-3 w-64 animate-pulse rounded bg-lav-soft motion-reduce:animate-none" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * One column's sort control: off, descending, ascending, off again.
 *
 * The arrow is the state — a button that looks identical whether or not it is
 * the active sort tells a manager nothing about why the list is in the order
 * it is in. `aria-sort` carries the same fact for a screen reader, since the
 * arrow is decorative to one.
 */
function SortButton({ label, column, sort, onToggle }) {
  const active = sort === `${column}_desc` ? 'desc' : sort === `${column}_asc` ? 'asc' : null;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : 'none'}
      aria-label={
        active
          ? `Sorted by ${label}, ${active === 'desc' ? 'highest first' : 'lowest first'}. Press to change.`
          : `Sort by ${label}`
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control border-[1.5px] px-3 py-2 text-[0.86rem] font-semibold transition-colors',
        active
          ? 'border-violet bg-violet-soft text-violet-deep'
          : 'border-line bg-white text-ink hover:border-violet',
      )}
    >
      {label}
      <span aria-hidden="true" className="text-[0.75rem] leading-none">
        {active === 'desc' ? '↓' : active === 'asc' ? '↑' : '⇅'}
      </span>
    </button>
  );
}

export function DashboardPage() {
  usePageMeta({
    title: 'Applicants — Fast Action Claims',
    description: 'Internal recruitment dashboard.',
    // Personal data. Never indexed, regardless of what stands in front of it.
    robots: 'noindex, nofollow',
  });

  // A token in this tab means a session that has not been signed out. It can
  // still be expired — the first request will say so, and that path is handled
  // the same way as never having signed in at all.
  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminToken()));
  const [adminEmail, setAdminEmail] = useState('');

  const [applicants, setApplicants] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  // Whether a decision actually reaches the candidate, answered by the server
  // rather than assumed. The confirmation says so in as many words, and it
  // must not promise an email that is only being written to a file.
  const [emailLive, setEmailLive] = useState(false);
  const [tabs, setTabs] = useState(EMPTY_TABS);
  // Applied-between, as yyyy-mm-dd from the two date inputs.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageSize, setPageSize] = useState(25);

  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // null means "newest first", the order this screen has always had. Sorting
  // is done by the server because the list is paginated: sorted here, "highest
  // score first" would only order the twenty-five rows already on screen.
  const [sort, setSort] = useState(null);
  const [aiLevel, setAiLevel] = useState('all');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [deciding, setDeciding] = useState(false);
  // Reset every time the dialog opens, so a reason chosen for one candidate
  // can never be carried into the next by a manager working through a list.
  const [reason, setReason] = useState(NO_REASON);
  const [reasonNote, setReasonNote] = useState('');
  const [decideError, setDecideError] = useState('');
  const [bookingLink, setBookingLink] = useState(null);
  const [actionError, setActionError] = useState('');

  // Filtering happens server-side — the list is paged, so filtering the
  // twenty-five rows in hand would silently ignore every match on page two.
  const search = useDebouncedValue(query, 300);
  const apiRole = role === 'all' ? 'all' : (ROLES[role]?.apiKey ?? 'all');

  const signOut = useCallback(() => {
    adminSignOut();
    setSignedIn(false);
    setApplicants([]);
    setSummary(EMPTY_SUMMARY);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await adminApplications({
        status,
        role: apiRole,
        q: search,
        page,
        from,
        to,
        sort,
        ai: aiLevel,
      });
      setApplicants(result.applications.map(normaliseApplicant));
      setSummary(normaliseSummary(result.summary));
      setTotal(result.total);
      setPageSize(result.pageSize);
      setEmailLive(Boolean(result.emailLive));
      setTabs(result.tabs ?? EMPTY_TABS);
    } catch (failure) {
      // An expired or rejected token is not an error to show — it is a request
      // to sign in again.
      if (failure.status === 401) signOut();
      else setLoadError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [status, apiRole, search, page, from, to, sort, aiLevel, signOut]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  /**
   * Opens the decision confirmation, re-checking whether email actually leaves.
   *
   * `emailLive` is captured when the list loads, and a dashboard left open
   * across a settings change then states the opposite of the truth. That is
   * not hypothetical: alerts were switched on while a tab sat open, so the
   * dialog said no email would reach the candidate while the acceptance email
   * was in fact sent — inviting the admin to send a duplicate by hand.
   *
   * So the question is asked again at the moment it is put. A failed check
   * leaves the last known answer rather than blocking the decision: being
   * unable to describe the consequence is not a reason to prevent the action.
   */
  const askToDecide = useCallback(async (id, decision) => {
    setDecideError('');
    setReason(NO_REASON);
    setReasonNote('');
    setConfirming({ id, decision });
    try {
      const settings = await adminSettings();
      setEmailLive(Boolean(settings.flags?.recruitment_alerts) && settings.mailMode === 'smtp');
    } catch {
      /* keep the value the list reported */
    }
  }, []);


  // A tab reloaded with a token still in it knows it is signed in but not as
  // whom. This also double-checks the token: if it has expired overnight, the
  // page falls back to sign-in rather than showing an empty list.
  useEffect(() => {
    if (!signedIn || adminEmail) return undefined;

    let cancelled = false;
    adminMe()
      .then(({ admin }) => {
        if (!cancelled) setAdminEmail(admin.email);
      })
      .catch((failure) => {
        if (!cancelled && failure.status === 401) signOut();
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, adminEmail, signOut]);

  /**
   * Any filter change puts you back on page one: staying on page four of a
   * result set that now has one page shows an empty list and looks broken.
   *
   * Done here rather than in an effect on purpose — resetting the page after
   * the filter had already changed would fire two requests for one click, the
   * first of them for a page nobody is looking at.
   */
  const applyFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const chooseStatus = applyFilter(setStatus);
  const changeFrom = applyFilter(setFrom);
  const changeTo = applyFilter(setTo);
  const chooseAiLevel = applyFilter(setAiLevel);

  /**
   * Cycles one column: descending, then ascending, then back to newest-first.
   *
   * Third press returns to the default rather than sticking on ascending —
   * otherwise there is no way back to the order the screen opens in without
   * reloading, and "lowest score first" is not a view anybody wants to be
   * stuck in.
   */
  const toggleSort = (column) => {
    setPage(1);
    setSort((current) =>
      current === `${column}_desc` ? `${column}_asc` : current === `${column}_asc` ? null : `${column}_desc`,
    );
  };
  const chooseRole = applyFilter(setRole);
  const changeQuery = applyFilter(setQuery);

  /**
   * A fresh booking link.
   *
   * The token is returned once and stored only as a hash, so a manager who
   * closed the dialog without copying it — or sent it to a typo — previously
   * had no way to help the candidate at all.
   */
  const reissue = async (id) => {
    setActionError('');
    try {
      const result = await adminReissueLink(id);
      setBookingLink({
        name: result.fullName,
        email: result.email,
        url: `${window.location.origin}/book/${result.bookingToken}`,
        reissued: true,
      });
      await load();
    } catch (failure) {
      if (failure.status === 401) signOut();
      else setActionError(failure.message);
    }
  };

  /** Whether they turned up. The only thing that can ever set the no-show count. */
  const markAttendance = async (id, status) => {
    setActionError('');
    try {
      await adminMarkAttendance(id, status);
      await load();
    } catch (failure) {
      if (failure.status === 401) signOut();
      else setActionError(failure.message);
    }
  };

  const confirmingApplicant = confirming ? applicants.find((a) => a.id === confirming.id) : null;

  const commit = async () => {
    if (!confirming || deciding) return;

    setDeciding(true);
    setDecideError('');
    try {
      const result = await adminDecide(
        confirming.id,
        confirming.decision,
        // Only ever sent on a decline. The server ignores it otherwise, but
        // not sending it keeps the request honest about what was asked.
        confirming.decision === 'declined' ? { reason, reasonNote } : undefined,
      );
      const applicant = confirmingApplicant;
      setConfirming(null);

      // The booking token comes back exactly once and is never retrievable
      // again. The email carrying it is queued by the same request, so this is
      // a copy for the manager rather than the candidate's only route — but a
      // token dropped on the floor is still a token nobody can recover, so it
      // is shown.
      if (result.bookingToken && applicant) {
        setBookingLink({
          name: applicant.fullName,
          email: applicant.email,
          url: `${window.location.origin}/book/${result.bookingToken}`,
        });
      }

      await load();
    } catch (failure) {
      if (failure.status === 401) signOut();
      // 409 means someone else decided it first. Reloading is the fix, and it
      // shows the decision that actually won.
      else if (failure.status === 409) {
        setDecideError(failure.message);
        await load();
      } else setDecideError(failure.message);
    } finally {
      setDeciding(false);
    }
  };

  if (!signedIn) {
    return (
      <AdminSignIn
        onSignedIn={(email) => {
          setAdminEmail(email);
          setSignedIn(true);
        }}
      />
    );
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = status !== 'all' || role !== 'all' || Boolean(search);

  return (
    <AdminShell
      current="applicants"
      title="Applicants"
      subtitle="Review, accept or decline. Accepting creates the candidate's booking link."
      email={adminEmail}
      onSignOut={signOut}
      actions={
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <Icon name="clock" size={15} />
          <span className="hidden sm:inline">{loading ? 'Refreshing…' : 'Refresh'}</span>
        </Button>
      }
    >
      {/* The prototype's header band, with the counts lifting out of its
          bottom edge. Inside the admin shell it is a rounded block rather than
          full-bleed, so it sits with the rail instead of fighting it. */}
      <section className="hero-glow relative overflow-hidden rounded-card bg-brand px-6 pb-16 pt-7 text-white">
        <div className="relative z-10">
          <p className="text-[0.8rem] font-semibold text-white/65">Recruitment</p>
          {/* Not a heading: the top bar already announces this page as
              "Applicants", and a second heading saying the same thing gives a
              screen reader two names for one screen. */}
          <p className="mt-1 text-[1.4rem] font-black leading-tight tracking-[-0.03em] sm:text-[1.6rem]">
            Paralegal applicants — India &amp; South Africa
          </p>
          {summary.pending > 0 ? (
            <p className="mt-3 inline-flex items-center rounded-full border border-white/[0.22] bg-white/10 px-3.5 py-1.5 text-[0.82rem] font-semibold backdrop-blur">
              {summary.pending} application{summary.pending === 1 ? '' : 's'} awaiting your decision
            </p>
          ) : (
            <p className="mt-3 inline-flex items-center rounded-full border border-white/[0.22] bg-white/10 px-3.5 py-1.5 text-[0.82rem] font-semibold backdrop-blur">
              Nothing is waiting on you
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="Summary"
        className="relative z-10 mb-6 -mt-10 grid grid-cols-2 gap-3.5 px-1 md:grid-cols-3 lg:grid-cols-6"
      >
        <Stat label="Total" value={summary.total} />
        <Stat label="Awaiting review" value={summary.pending} tone="warn" />
        <Stat label="Accepted" value={summary.accepted} tone="ok" />
        <Stat label="Declined" value={summary.declined} tone="danger" />
        <Stat label="Interviews booked" value={summary.booked} tone="brand" />
        <Stat label="AI detected" value={summary.aiFlagged} tone="danger" />
      </section>

      {actionError ? (
        <p
          role="alert"
          className="mb-4 rounded-panel border border-danger/30 bg-red-50 px-4 py-3 text-[0.88rem] font-medium text-danger"
        >
          {actionError}
        </p>
      ) : null}

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* The count says what you would get if you clicked it, so it is
                scoped by the role and dates already chosen but never by the
                status the button itself applies. */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => chooseStatus(f.key)}
                  aria-pressed={status === f.key}
                  className={cn(
                    'rounded-full px-4 py-2 text-[0.85rem] font-semibold transition-colors',
                    status === f.key
                      ? 'bg-ink text-white'
                      : 'border border-line bg-white text-ink hover:border-violet',
                  )}
                >
                  {f.label}{' '}
                  <span className={cn('font-bold', status === f.key ? 'text-white/70' : 'text-muted')}>
                    {tabs[f.countKey]}
                  </span>
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="applied-from">
                Applied from
              </label>
              <input
                id="applied-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => changeFrom(e.target.value)}
                className="rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-[0.85rem] text-ink focus:border-violet focus:outline-none"
              />
              <span className="text-[0.85rem] text-muted">to</span>
              <label className="sr-only" htmlFor="applied-to">
                Applied to
              </label>
              <input
                id="applied-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => changeTo(e.target.value)}
                className="rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-[0.85rem] text-ink focus:border-violet focus:outline-none"
              />
              <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by role">
              <button
                type="button"
                onClick={() => chooseRole('all')}
                aria-pressed={role === 'all'}
                className={cn(
                  'rounded-control px-3.5 py-2 text-[0.85rem] font-semibold transition-colors',
                  role === 'all'
                    ? 'border-[1.5px] border-violet bg-white text-violet-deep'
                    : 'border-[1.5px] border-line bg-white text-ink hover:border-violet',
                )}
              >
                All roles
              </button>
              {Object.values(ROLES).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => chooseRole(r.key)}
                  aria-pressed={role === r.key}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-control px-3.5 py-2 text-[0.85rem] font-semibold transition-colors',
                    role === r.key
                      ? 'border-[1.5px] border-violet bg-white text-violet-deep'
                      : 'border-[1.5px] border-line bg-white text-ink hover:border-violet',
                  )}
                >
                  <Flag country={r.countryCode} className="h-2.5 w-[15px] flex-shrink-0 rounded-[1px]" />
                  {r.short}
                </button>
              ))}
            </div>

            {/* Sort, and the AI band. Placed before the search box so the ml-auto
                on that box still pushes it to the right-hand end. */}
            <div className="flex flex-wrap items-center gap-2">
              <SortButton
                label="Score"
                column="score"
                sort={sort}
                onToggle={toggleSort}
              />
              <SortButton
                label="Time taken"
                column="duration"
                sort={sort}
                onToggle={toggleSort}
              />

              <label htmlFor="ai-filter" className="sr-only">
                Filter by AI check
              </label>
              <select
                id="ai-filter"
                value={aiLevel}
                onChange={(e) => chooseAiLevel(e.target.value)}
                className={cn(
                  'rounded-control border-[1.5px] bg-white py-2 pl-3 pr-8 text-[0.86rem] font-semibold focus:border-violet focus:outline-none',
                  aiLevel === 'all' ? 'border-line text-ink' : 'border-violet text-violet-deep',
                )}
              >
                <option value="all">AI check: all</option>
                <option value="clean">Clean</option>
                <option value="possible">Possible AI</option>
                <option value="ai_used">AI used</option>
              </select>
            </div>

            <div className="relative ml-auto w-full sm:w-64">
              <label htmlFor="applicant-search" className="sr-only">
                Search applicants by name or email
              </label>
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="applicant-search"
                type="search"
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-control border-[1.5px] border-line bg-white py-2 pl-9 pr-3 text-[0.88rem] focus:border-violet focus:outline-none"
              />
            </div>
          </div>
        </div>

        {loading && applicants.length === 0 ? (
          <RowSkeleton />
        ) : loadError ? (
          <EmptyState
            title="Could not load applicants"
            body={loadError}
            action={
              <Button variant="secondary" onClick={load}>
                Try again
              </Button>
            }
          />
        ) : applicants.length > 0 ? (
          <div>
            <table
              aria-busy={loading || undefined}
              className={cn('w-full table-fixed border-collapse text-left', loading && 'opacity-60')}
            >
              <thead>
                <tr className="bg-lav-soft text-[0.78rem] font-semibold text-muted">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn('whitespace-nowrap px-3 py-3 font-semibold', column.width, column.cell)}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th scope="col" className={cn('py-3 pr-3', CHEVRON_WIDTH)}>
                    <span className="sr-only">Show details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((applicant) => (
                  <ApplicantRow
                    key={applicant.id}
                    applicant={applicant}
                    onDecide={askToDecide}
                    onReissue={reissue}
                    onAttendance={markAttendance}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : filtered ? (
          <EmptyState
            title="No applicants match those filters"
            body="Try clearing the search or switching back to all roles."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setPage(1);
                  setStatus('all');
                  setRole('all');
                  setQuery('');
                  setAiLevel('all');
                  setSort(null);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No applications yet"
            body="Applications appear here the moment a candidate submits one."
          />
        )}
      </Card>

      {/* Announced, so a screen reader hears the result count change rather
            than having to go looking for it. */}
      <p role="status" className="mt-4 text-center text-[0.8rem] text-muted">
        {total === 0
          ? 'No applicants'
          : `Showing ${applicants.length} of ${total} applicant${total === 1 ? '' : 's'}`}
      </p>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-3 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            <Icon name="arrowLeft" size={15} />
            Previous
          </Button>
          <span className="text-[0.82rem] text-muted tabular">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages || loading}
          >
            Next
            <Icon name="arrowRight" size={15} />
          </Button>
        </nav>
      ) : null}

      {/* Confirmation. A decision is recorded against your name and cannot be
          taken back — it should never be one stray click away. */}
      {confirming && confirmingApplicant ? (
        <Modal
          titleId="confirm-title"
          className="max-w-md"
          onClose={() => (deciding ? null : setConfirming(null))}
        >
          <h2 id="confirm-title" className="text-[1.15rem] font-bold text-ink">
            {confirming.decision === 'accepted' ? 'Accept' : 'Decline'}{' '}
            {confirmingApplicant.fullName}?
          </h2>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
            {confirming.decision === 'accepted' ? (
              <>
                This shortlists{' '}
                <b className="font-semibold text-ink">{confirmingApplicant.email}</b> and creates
                their interview booking link.
              </>
            ) : (
              <>
                This marks <b className="font-semibold text-ink">{confirmingApplicant.email}</b> as
                unsuccessful. It cannot be undone.
              </>
            )}
          </p>
          {/* The consequence people most need to see before clicking: this
              leaves the building. Said only when it is true. */}
          <p
            className={cn(
              'mt-3 flex items-start gap-2 rounded-panel border p-3 text-[0.85rem] leading-relaxed',
              emailLive
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-line bg-lav-soft/60 text-muted',
            )}
          >
            <Icon
              name={emailLive ? 'alert' : 'file'}
              size={16}
              className="mt-0.5 flex-shrink-0"
            />
            <span>
              {emailLive ? (
                <>
                  <b className="font-semibold">A real email is sent immediately.</b>{' '}
                  {confirmingApplicant.fullName} will receive this
                  {confirming.decision === 'accepted'
                    ? ' shortlisting email, with their booking link.'
                    : ' decision by email.'}{' '}
                  It cannot be recalled.
                </>
              ) : (
                <>
                  No email will reach them: the message is written to a file on the server instead.
                  Contact them yourself.
                </>
              )}
            </span>
          </p>
          {/* Why, when declining. Not shown on an accept: there is nothing to
              explain, and a field that means nothing half the time is a field
              people stop reading. */}
          {confirming.decision === 'declined' ? (
            <div className="mt-4">
              <label
                htmlFor="decline-reason"
                className="block text-[0.8rem] font-bold uppercase tracking-wide text-muted"
              >
                Reason
              </label>
              <select
                id="decline-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={deciding}
                className="mt-1.5 w-full rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-[0.88rem] focus:border-violet focus:outline-none"
              >
                {DECLINE_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>

              {reason === 'other' ? (
                <>
                  <label htmlFor="decline-note" className="sr-only">
                    Write the reason
                  </label>
                  <textarea
                    id="decline-note"
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value.slice(0, 500))}
                    disabled={deciding}
                    rows={3}
                    placeholder="In your own words — this is sent to the candidate."
                    className="mt-2 w-full rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-[0.88rem] focus:border-violet focus:outline-none"
                  />
                  <p className="mt-1 text-[0.78rem] text-muted">
                    {reasonNote.trim().length}/500 · written exactly as typed, so read it back
                    before sending.
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted">
                  {reason === NO_REASON
                    ? 'No reason is recorded, and the email says only that the application was unsuccessful.'
                    : `The candidate is told: “${declineReason(reason)?.sentence ?? ''}”`}
                </p>
              )}
            </div>
          ) : null}

          {decideError ? (
            <p role="alert" className="mt-3 text-[0.85rem] font-medium text-danger">
              {decideError}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={deciding}>
              Cancel
            </Button>
            <Button
              variant={confirming.decision === 'accepted' ? 'primary' : 'danger'}
              onClick={commit}
              disabled={deciding}
            >
              {deciding
                ? 'Saving…'
                : `Yes, ${confirming.decision === 'accepted' ? 'accept' : 'decline'}`}
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* The booking link, shown once.
          Automatic email is no longer "stage 5" — accepting queues the
          shortlisting email with this link in it, and so does reissuing. So
          what this dialog is for changed: it used to be the only way the
          candidate got the link, and is now a copy for the manager in case
          they need it. The wording follows `emailLive` rather than stating
          either, because a dialog that tells somebody to send an email that
          has already gone gets the candidate two. */}
      {bookingLink ? (
        <Modal
          titleId="booking-title"
          className="max-w-lg"
          // Not dismissable: the link inside cannot be retrieved a second
          // time, so it takes a deliberate "Done" to close.
          dismissable={false}
        >
          <h2 id="booking-title" className="text-[1.15rem] font-bold text-ink">
            {emailLive
              ? `${bookingLink.name}'s ${bookingLink.reissued ? 'new ' : ''}booking link`
              : `Send ${bookingLink.name} their ${bookingLink.reissued ? 'new ' : ''}booking link`}
          </h2>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
            {emailLive ? (
              <>
                This has already been emailed to{' '}
                <b className="font-semibold text-ink">{bookingLink.email}</b>. Here it is as well,
                in case you need it — <b className="font-semibold text-ink">it is shown once</b> and
                cannot be retrieved again.{' '}
              </>
            ) : (
              <>
                No email is being sent, so send this to{' '}
                <b className="font-semibold text-ink">{bookingLink.email}</b> yourself.{' '}
                <b className="font-semibold text-ink">This link is shown once</b> — it cannot be
                retrieved again.{' '}
              </>
            )}
            {bookingLink.reissued ? 'Their previous link has stopped working.' : ''}
          </p>
          <p className="mt-4 break-all rounded-panel border border-line bg-lav-soft p-3 font-mono text-[0.8rem] text-ink">
            {bookingLink.url}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(bookingLink.url)}
            >
              Copy link
            </Button>
            <Button
              href={`mailto:${bookingLink.email}?subject=${encodeURIComponent(
                'Your interview with Fast Action Claims',
              )}&body=${encodeURIComponent(
                `Hi ${bookingLink.name},\n\nGood news — we would like to invite you to an interview. ` +
                  `Please pick a time that suits you here:\n\n${bookingLink.url}\n\nBest wishes,\nFast Action Claims`,
              )}`}
            >
              <Icon name="mail" size={15} />
              Open in email
            </Button>
            <Button variant="quiet" onClick={() => setBookingLink(null)}>
              Done
            </Button>
          </div>
        </Modal>
      ) : null}
    </AdminShell>
  );
}

export default DashboardPage;
