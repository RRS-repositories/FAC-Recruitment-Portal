import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ApplicantRow } from '@/features/dashboard/ApplicantRow';
import { AdminSignIn } from '@/features/dashboard/AdminSignIn';
import { ROLES } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { adminApplications, adminDecide, adminMe, adminSignOut, getAdminToken } from '@/lib/api';
import { normaliseApplicant, normaliseSummary } from '@/lib/normalise';
import { cn } from '@/lib/cn';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

const EMPTY_SUMMARY = normaliseSummary();

/**
 * One summary figure. Only the counts a manager acts on get a tile — a tile
 * for every number turns the row into decoration and hides the one that
 * matters.
 */
function Stat({ label, value, tone = 'default', icon }) {
  return (
    <div
      className={cn(
        'rounded-panel border bg-white p-4',
        tone === 'alert' && value > 0 ? 'border-amber-300 bg-amber-50' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 text-muted">
        {icon ? <Icon name={icon} size={15} /> : null}
        <span className="text-[0.74rem] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <b className="mt-1.5 block text-[1.6rem] font-black leading-none text-ink tabular">{value}</b>
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
  const [pageSize, setPageSize] = useState(25);

  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState('');
  const [bookingLink, setBookingLink] = useState(null);

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
      });
      setApplicants(result.applications.map(normaliseApplicant));
      setSummary(normaliseSummary(result.summary));
      setTotal(result.total);
      setPageSize(result.pageSize);
    } catch (failure) {
      // An expired or rejected token is not an error to show — it is a request
      // to sign in again.
      if (failure.status === 401) signOut();
      else setLoadError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [status, apiRole, search, page, signOut]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

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
  const chooseRole = applyFilter(setRole);
  const changeQuery = applyFilter(setQuery);

  const confirmingApplicant = confirming ? applicants.find((a) => a.id === confirming.id) : null;

  const commit = async () => {
    if (!confirming || deciding) return;

    setDeciding(true);
    setDecideError('');
    try {
      const result = await adminDecide(confirming.id, confirming.decision);
      const applicant = confirmingApplicant;
      setConfirming(null);

      // The booking token comes back exactly once and is never retrievable
      // again. Until stage 5 sends the email, showing it here is the only way
      // it reaches the candidate — so it is shown rather than dropped.
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
    <AppShell
      navRight={
        <div className="flex min-w-0 items-center gap-3">
          {/* A work email is longer than a 320px bar has room for, and it is
              not what anyone came to the page for. It reappears as soon as
              there is space; the sign-out button never disappears. */}
          {adminEmail ? (
            <span className="hidden max-w-[11rem] truncate text-[0.8rem] text-white/60 sm:inline lg:max-w-none">
              {adminEmail}
            </span>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="flex-shrink-0 rounded-control border border-white/20 px-3 py-1.5 text-[0.8rem] font-semibold text-white hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-wide px-5 py-8 sm:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-display-md font-extrabold text-ink">Applicants</h1>
            <p className="mt-1 text-[0.92rem] text-muted">
              Review, accept or decline. Accepting creates the candidate&rsquo;s booking link.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <Icon name="clock" size={15} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </header>

        <section
          aria-label="Summary"
          className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6"
        >
          <Stat label="Total" value={summary.total} icon="user" />
          <Stat label="Awaiting" value={summary.pending} icon="clock" />
          <Stat label="Accepted" value={summary.accepted} icon="check" />
          <Stat label="Booked" value={summary.booked} icon="calendar" />
          <Stat label="No-shows" value={summary.noShows} icon="alert" tone="alert" />
          <Stat label="AI flagged" value={summary.aiFlagged} icon="sparkle" tone="alert" />
        </section>

        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4 sm:p-5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => chooseStatus(f.key)}
                  aria-pressed={status === f.key}
                  className={cn(
                    'rounded-control px-3 py-2 text-[0.83rem] font-semibold transition-colors',
                    status === f.key
                      ? 'bg-ink text-white'
                      : 'border border-line bg-white text-ink hover:border-violet',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
              <button
                type="button"
                onClick={() => chooseRole('all')}
                aria-pressed={role === 'all'}
                className={cn(
                  'rounded-control px-3 py-2 text-[0.83rem] font-semibold transition-colors',
                  role === 'all'
                    ? 'bg-violet text-white'
                    : 'border border-line bg-white text-ink hover:border-violet',
                )}
              >
                Both roles
              </button>
              {Object.values(ROLES).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => chooseRole(r.key)}
                  aria-pressed={role === r.key}
                  className={cn(
                    'rounded-control px-3 py-2 text-[0.83rem] font-semibold transition-colors',
                    role === r.key
                      ? 'bg-violet text-white'
                      : 'border border-line bg-white text-ink hover:border-violet',
                  )}
                >
                  {r.country}
                </button>
              ))}
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
            <ul aria-busy={loading || undefined} className={cn(loading && 'opacity-60')}>
              {applicants.map((applicant) => (
                <ApplicantRow
                  key={applicant.id}
                  applicant={applicant}
                  onDecide={(id, decision) => {
                    setDecideError('');
                    setConfirming({ id, decision });
                  }}
                />
              ))}
            </ul>
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
      </div>

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

      {/* The booking link, shown once. Automatic email is stage 5; until then
          this is how the candidate gets it, so it must not be dismissable by
          accident. */}
      {bookingLink ? (
        <Modal
          titleId="booking-title"
          className="max-w-lg"
          // Not dismissable: the link inside cannot be retrieved a second
          // time, so it takes a deliberate "Done" to close.
          dismissable={false}
        >
          <h2 id="booking-title" className="text-[1.15rem] font-bold text-ink">
            Send {bookingLink.name} their booking link
          </h2>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
            Automatic emails are not switched on yet, so send this to{' '}
            <b className="font-semibold text-ink">{bookingLink.email}</b> yourself.{' '}
            <b className="font-semibold text-ink">This link is shown once</b> — it cannot be
            retrieved again.
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
    </AppShell>
  );
}

export default DashboardPage;
