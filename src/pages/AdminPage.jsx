import { useCallback, useEffect, useState } from 'react';
import Container from '@/components/ui/Container';
import Icon from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import usePageMeta from '@/hooks/usePageMeta';

/**
 * Enquiry inbox.
 *
 * Sits behind Cloudflare Access, and the API verifies that token itself rather
 * than trusting the edge — see server/lib/access.mjs for why. Deliberately
 * plain: this is a working tool, read at a glance, not a marketing page.
 */

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'closed', label: 'Closed' },
  { key: 'spam', label: 'Spam' },
];

const STATUS_STYLES = {
  new: 'bg-gold/20 text-gold-deep',
  contacted: 'bg-[#e3f2ea] text-[#1c6f47]',
  closed: 'bg-slate-100 text-muted',
  spam: 'bg-[#fbeceb] text-[#a8231c]',
};

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function StatusPill({ status }) {
  return (
    <span
      className={cn(
        'inline-block rounded px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status] ?? 'bg-slate-100 text-muted',
      )}
    >
      {status}
    </span>
  );
}

function EnquiryRow({ enquiry, onStatusChange, busy }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-hairline last:border-0">
      <div className="grid gap-2 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <b className="text-[0.95rem] text-navy">{enquiry.name}</b>
            {enquiry.company ? <span className="text-[0.85rem] text-muted">{enquiry.company}</span> : null}
            <StatusPill status={enquiry.status} />
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.85rem]">
            <a href={`mailto:${enquiry.email}`} className="text-gold-deep underline">
              {enquiry.email}
            </a>
            {enquiry.phone ? (
              <a href={`tel:${enquiry.phone}`} className="text-muted">
                {enquiry.phone}
              </a>
            ) : null}
          </div>

          <p className="mt-1 text-[0.8rem] text-muted">
            {dateFormat.format(new Date(enquiry.created_at))}
            {enquiry.role_type ? ` · ${enquiry.role_type}` : ''}
            {enquiry.headcount ? ` · ${enquiry.headcount} people` : ''}
            {enquiry.notified_at ? ' · notified' : ' · not notified'}
          </p>

          {enquiry.message ? (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="mt-1.5 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-navy hover:text-gold-deep"
              >
                {open ? 'Hide message' : 'Show message'}
                <Icon name="chevronDown" size={14} className={cn('transition-transform', open && 'rotate-180')} />
              </button>
              {open ? (
                <p className="mt-2 whitespace-pre-wrap rounded bg-cream p-3 text-[0.88rem] text-ink">
                  {enquiry.message}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 gap-1.5">
          {['contacted', 'closed', 'spam'].map((next) =>
            enquiry.status === next ? null : (
              <button
                key={next}
                type="button"
                disabled={busy}
                onClick={() => onStatusChange(enquiry.id, next)}
                className="rounded border border-hairline px-2.5 py-1 text-[0.75rem] font-semibold text-navy transition-colors hover:border-gold hover:text-gold-deep disabled:opacity-50"
              >
                {next === 'spam' ? 'Spam' : next === 'closed' ? 'Close' : 'Contacted'}
              </button>
            ),
          )}
        </div>
      </div>
    </li>
  );
}

export function AdminPage() {
  // noindex/nofollow: this page lists personal data and must never be crawled,
  // even though Access should stop a crawler reaching it in the first place.
  usePageMeta({
    title: 'Enquiries — Atlas Recruitment',
    description: 'Internal enquiry inbox.',
    robots: 'noindex, nofollow',
  });

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('q', search);
    params.set('page', String(page));

    try {
      const response = await fetch(`/api/admin/enquiries?${params}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || `Could not load enquiries (HTTP ${response.status}).`);
        return;
      }
      setData(payload);
    } catch {
      setError('Could not reach the server.');
    }
  }, [status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const changeStatus = async (id, next) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || 'Could not update that enquiry.');
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="min-h-screen bg-cream pb-16 pt-28">
      <Container>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-[1.9rem] text-navy">Enquiries</h1>
          {data?.viewer ? <p className="text-[0.8rem] text-muted">Signed in as {data.viewer}</p> : null}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              aria-pressed={status === tab.key}
              className={cn(
                'rounded-brand px-3 py-1.5 text-[0.85rem] font-semibold transition-colors',
                status === tab.key
                  ? 'bg-navy text-white'
                  : 'border border-hairline bg-white text-navy hover:border-gold',
              )}
            >
              {tab.label}
              {data?.counts && tab.key && data.counts[tab.key] != null ? (
                <span className="ml-1.5 opacity-70">{data.counts[tab.key]}</span>
              ) : null}
            </button>
          ))}

          <label htmlFor="admin-search" className="sr-only">
            Search enquiries
          </label>
          <input
            id="admin-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email or company"
            className="ml-auto w-full rounded-brand border-[1.5px] border-hairline bg-white px-3 py-1.5 text-[0.88rem] focus:border-gold focus:outline-none sm:w-72"
          />
        </div>

        {error ? (
          <p role="alert" className="mb-4 rounded border-[1.5px] border-[#b3261e] bg-[#fdf3f2] px-4 py-3 text-[0.9rem] font-medium text-[#b3261e]">
            {error}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-card border border-hairline bg-white">
          {!data && !error ? (
            <p className="px-4 py-10 text-center text-muted">Loading…</p>
          ) : data?.enquiries?.length ? (
            <ul>
              {data.enquiries.map((enquiry) => (
                <EnquiryRow
                  key={enquiry.id}
                  enquiry={enquiry}
                  busy={busy}
                  onStatusChange={changeStatus}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-muted">
              {search || status ? 'No enquiries match that filter.' : 'No enquiries yet.'}
            </p>
          )}
        </div>

        {data && data.total > data.pageSize ? (
          <div className="mt-4 flex items-center justify-between text-[0.85rem]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-brand border border-hairline bg-white px-3 py-1.5 font-semibold text-navy disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-muted">
              Page {page} of {totalPages} · {data.total} enquiries
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-brand border border-hairline bg-white px-3 py-1.5 font-semibold text-navy disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </Container>
    </section>
  );
}

export default AdminPage;
