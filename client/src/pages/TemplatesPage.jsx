import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminSignIn } from '@/features/dashboard/AdminSignIn';
import { adminSignOut, adminTemplates, getAdminToken } from '@/lib/api';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';

/**
 * Every email the portal can send, as a manager would read it.
 *
 * The reason this page exists: a rejection letter is not something to discover
 * the wording of after it has gone to forty people. These are rendered from
 * invented sample data — never a real candidate — so the page can be opened
 * and read at any time without exposing anyone.
 *
 * It also answers the question the templates cannot: whether any of this is
 * actually being delivered. A perfect set of emails that nothing sends is a
 * worse state than an obviously broken one, because it looks finished.
 */

const AUDIENCE_LABEL = { candidate: 'To the candidate', manager: 'To the team' };

/** Groups the list the way a manager thinks about it: by when it happens. */
const STAGE_OF = (key) => {
  if (key === 'recruit.ack') return 'When they apply';
  if (key.includes('accept') || key.includes('decline')) return 'When you decide';
  if (key.startsWith('recruit.reminder')) return 'Before the interview';
  if (key === 'recruit.noshow') return 'After the interview';
  return 'Around the booking';
};

const STAGE_ORDER = [
  'When they apply',
  'When you decide',
  'Around the booking',
  'Before the interview',
  'After the interview',
];

export function TemplatesPage() {
  usePageMeta({
    title: 'Email templates — Fast Action Claims',
    description: 'What the portal sends, and when.',
    robots: 'noindex, nofollow',
  });

  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminToken()));
  const [templates, setTemplates] = useState([]);
  const [mode, setMode] = useState(null);
  // Which half of the email is on screen. Defaults to the one nearly
  // every candidate actually sees.
  const [view, setView] = useState('rendered');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const signOut = useCallback(() => {
    adminSignOut();
    setSignedIn(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminTemplates();
      setTemplates(result.templates);
      setMode(result.mode);
      setSelected((current) => current ?? result.templates[0]?.key ?? null);
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

  if (!signedIn) return <AdminSignIn onSignedIn={() => setSignedIn(true)} />;

  const current = templates.find((t) => t.key === selected) ?? null;
  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    items: templates.filter((t) => STAGE_OF(t.key) === stage),
  })).filter((group) => group.items.length > 0);

  return (
    <AdminShell
      current="templates"
      title="Email templates"
      subtitle="Every email the portal can send, and when it sends it — with example details, never a real candidate's."
      onSignOut={signOut}
    >
      {/* The state of delivery, stated before any of the wording — because a
            perfect template that nothing sends is the more dangerous problem. */}
      {mode === 'file' ? (
        <p className="mb-6 flex items-start gap-3 rounded-panel border border-amber-300 bg-amber-50 p-4 text-[0.88rem] leading-relaxed text-amber-900">
          <Icon name="alert" size={18} className="mt-0.5 flex-shrink-0" />
          <span>
            <b className="font-semibold">These emails are not being delivered yet.</b> Each one is
            written to a file on the server instead, so it can be read and checked. Nothing reaches
            a candidate until the recruitment mailbox is set up — until then, send booking links by
            hand from the applicant list.
          </span>
        </p>
      ) : null}

      {loading ? (
        <Card className="animate-pulse motion-reduce:animate-none" aria-busy="true">
          <div className="h-5 w-56 rounded bg-lav-soft" />
          <div className="mt-4 h-4 w-full rounded bg-lav-soft" />
          <div className="mt-2 h-4 w-4/5 rounded bg-lav-soft" />
          <p className="sr-only" role="status">
            Loading templates
          </p>
        </Card>
      ) : error ? (
        <Card padded={false}>
          <EmptyState
            title="Could not load the templates"
            body={error}
            action={
              <Button variant="secondary" onClick={load}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[19rem_1fr] lg:items-start">
          {/* The list. Grouped by when each email happens, which is how a
                manager looks for one — not alphabetically by key. */}
          <nav aria-label="Templates" className="grid gap-4">
            {stages.map(({ stage, items }) => (
              <div key={stage}>
                <h2 className="mb-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-muted">
                  {stage}
                </h2>
                <ul className="grid gap-1">
                  {items.map((template) => (
                    <li key={template.key}>
                      <button
                        type="button"
                        onClick={() => setSelected(template.key)}
                        aria-current={template.key === selected ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left text-[0.88rem] font-medium transition-colors',
                          template.key === selected
                            ? 'bg-ink text-white'
                            : 'border border-line bg-white text-ink hover:border-violet',
                        )}
                      >
                        {template.error ? (
                          <Icon name="alert" size={15} className="flex-shrink-0 text-danger" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{template.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* The email itself. */}
          {current ? (
            <Card>
              <div className="border-b border-line pb-4">
                <h2 className="text-[1.2rem] font-bold text-ink">{current.title}</h2>
                <p className="mt-1 text-[0.86rem] text-muted">{current.when}</p>
                {current.description ? (
                  <p className="mt-2 text-[0.88rem] leading-relaxed text-body">
                    {current.description}
                  </p>
                ) : null}
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.76rem] text-muted">
                  <span className="rounded bg-lav-soft px-2 py-0.5 font-mono">{current.key}</span>
                  <span>{AUDIENCE_LABEL[current.audience] ?? AUDIENCE_LABEL.candidate}</span>
                </p>
              </div>

              {current.error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-panel border border-danger/30 bg-red-50 p-4 text-[0.88rem] font-medium text-danger"
                >
                  This template is broken and could not be rendered: {current.error}
                </p>
              ) : (
                <>
                  <dl className="mt-5">
                    <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
                      Subject
                    </dt>
                    <dd className="mt-1 text-[0.98rem] font-semibold text-ink">
                      {current.preview.subject}
                    </dd>
                  </dl>

                  <div className="mt-5">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
                        Message
                      </p>
                      {/* Both, because both go out. The HTML is what almost
                          everyone sees; the plain text is what lands when a
                          client blocks it, and it is the half a manager can
                          actually proofread. */}
                      {current.preview.html ? (
                        <div className="flex gap-1" role="group" aria-label="How to view the message">
                          {[
                            ['rendered', 'As it arrives'],
                            ['text', 'Plain text'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setView(value)}
                              aria-pressed={view === value}
                              className={cn(
                                'rounded-control px-3 py-1.5 text-[0.78rem] font-semibold transition-colors',
                                view === value
                                  ? 'bg-ink text-white'
                                  : 'border border-line bg-white text-ink hover:border-violet',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {current.preview.html && view === 'rendered' ? (
                      // Sandboxed: it is our own markup, but an iframe is what
                      // stops the email's styles leaking into the dashboard.
                      <iframe
                        key={current.key}
                        title={`${current.title} — as the candidate receives it`}
                        srcDoc={current.preview.html}
                        sandbox=""
                        className="h-[560px] w-full rounded-panel border border-line bg-white"
                      />
                    ) : (
                      <pre className="overflow-x-auto whitespace-pre-wrap rounded-panel border border-line bg-lav-soft/60 p-4 font-mono text-[0.82rem] leading-relaxed text-body">
                        {current.preview.text}
                      </pre>
                    )}
                  </div>

                  {current.preview.attachments?.length ? (
                    <p className="mt-3 flex items-center gap-2 text-[0.82rem] text-muted">
                      <Icon name="file" size={15} />
                      Attached: {current.preview.attachments.map((a) => a.filename).join(', ')}
                    </p>
                  ) : null}

                  {current.mergeFields?.length ? (
                    <p className="mt-5 text-[0.78rem] leading-relaxed text-muted">
                      The example details above are replaced with the real candidate&rsquo;s:{' '}
                      {current.mergeFields.join(', ')}.
                    </p>
                  ) : null}
                </>
              )}
            </Card>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-center text-[0.8rem] leading-relaxed text-muted">
        The wording lives in the code, so a change is reviewed before it ships and cannot be altered
        by accident. Ask for an edit and it will be in the next deploy.
      </p>
    </AdminShell>
  );
}

export default TemplatesPage;
