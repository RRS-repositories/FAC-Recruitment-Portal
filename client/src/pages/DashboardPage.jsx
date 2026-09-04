import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ApplicantRow } from '@/features/dashboard/ApplicantRow';
import { MOCK_APPLICANTS, summarise } from '@/data/mockApplicants';
import { ROLES } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

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

export function DashboardPage() {
  usePageMeta({
    title: 'Applicants — Fast Action Claims',
    description: 'Internal recruitment dashboard.',
    // Personal data. Never indexed, regardless of what stands in front of it.
    robots: 'noindex, nofollow',
  });

  const [applicants, setApplicants] = useState(MOCK_APPLICANTS);
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(null);

  const stats = useMemo(() => summarise(applicants), [applicants]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applicants.filter((a) => {
      if (status !== 'all' && a.status !== status) return false;
      if (role !== 'all' && a.role !== role) return false;
      if (!q) return true;
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      );
    });
  }, [applicants, status, role, query]);

  // A decision sends a real email to a real person, so it is confirmed first —
  // and the dialog names which email, per spec §8.1.
  const commit = () => {
    if (!confirming) return;
    setApplicants((list) =>
      list.map((a) =>
        a.id === confirming.id
          ? {
              ...a,
              status: confirming.decision,
              interviewStatus: confirming.decision === 'accepted' ? 'invited' : a.interviewStatus,
            }
          : a,
      ),
    );
    setConfirming(null);
  };

  const pendingApplicant = confirming
    ? applicants.find((a) => a.id === confirming.id)
    : null;

  return (
    <AppShell
      navRight={<span className="text-[0.8rem] text-white/60">Signed in as brad@fastactionclaims.co.uk</span>}
    >
      <div className="mx-auto max-w-wide px-5 py-8 sm:px-8">
        <header className="mb-6">
          <h1 className="text-display-md font-extrabold text-ink">Applicants</h1>
          <p className="mt-1 text-[0.92rem] text-muted">
            Review, accept or decline. Accepting sends the candidate a booking link.
          </p>
        </header>

        <section aria-label="Summary" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Total" value={stats.total} icon="user" />
          <Stat label="Awaiting" value={stats.pending} icon="clock" />
          <Stat label="Accepted" value={stats.accepted} icon="check" />
          <Stat label="Booked" value={stats.booked} icon="calendar" />
          <Stat label="No-shows" value={stats.noShows} icon="alert" tone="alert" />
          <Stat label="AI flagged" value={stats.aiFlagged} icon="sparkle" tone="alert" />
        </section>

        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4 sm:p-5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatus(f.key)}
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
                onClick={() => setRole('all')}
                aria-pressed={role === 'all'}
                className={cn(
                  'rounded-control px-3 py-2 text-[0.83rem] font-semibold transition-colors',
                  role === 'all' ? 'bg-violet text-white' : 'border border-line bg-white text-ink hover:border-violet',
                )}
              >
                Both roles
              </button>
              {Object.values(ROLES).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  aria-pressed={role === r.key}
                  className={cn(
                    'rounded-control px-3 py-2 text-[0.83rem] font-semibold transition-colors',
                    role === r.key ? 'bg-violet text-white' : 'border border-line bg-white text-ink hover:border-violet',
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-control border-[1.5px] border-line bg-white py-2 pl-9 pr-3 text-[0.88rem] focus:border-violet focus:outline-none"
              />
            </div>
          </div>

          {visible.length > 0 ? (
            <ul>
              {visible.map((applicant) => (
                <ApplicantRow
                  key={applicant.id}
                  applicant={applicant}
                  onDecide={(id, decision) => setConfirming({ id, decision })}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No applicants match those filters"
              body="Try clearing the search or switching back to all roles."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatus('all');
                    setRole('all');
                    setQuery('');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
        </Card>

        <p className="mt-4 text-center text-[0.8rem] text-muted">
          Showing {visible.length} of {applicants.length} applicants
        </p>
      </div>

      {/* Confirmation. A decision emails a real person — it should never be one
          stray click away. */}
      {confirming && pendingApplicant ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5 animate-fade-in motion-reduce:animate-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <Card className="w-full max-w-md animate-pop-in motion-reduce:animate-none">
            <h2 id="confirm-title" className="text-[1.15rem] font-bold text-ink">
              {confirming.decision === 'accepted' ? 'Accept' : 'Decline'} {pendingApplicant.fullName}?
            </h2>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
              This sends the{' '}
              <b className="font-semibold text-ink">
                {confirming.decision === 'accepted' ? 'shortlisted' : 'unsuccessful'}
              </b>{' '}
              email to <b className="font-semibold text-ink">{pendingApplicant.email}</b>
              {confirming.decision === 'accepted'
                ? ', including a link to book their interview.'
                : '. This cannot be undone.'}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                variant={confirming.decision === 'accepted' ? 'primary' : 'danger'}
                onClick={commit}
              >
                Yes, send it
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}

export default DashboardPage;
