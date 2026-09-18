import { cn } from '@/lib/cn';

/**
 * The small pieces the extended applicant details are drawn from, shared with
 * a role's own sections (the sales voice note) so they sit on the same type
 * scale. Same shape as ApplicantRow's own Detail.
 */

export function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.88rem] text-ink">{children || '—'}</dd>
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">{children}</p>
  );
}

/** A grey block the size of what is coming, so the layout does not jump. */
export function Placeholder({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-panel bg-white/70 motion-reduce:animate-none', className)}
    />
  );
}
