import { Badge } from '@/components/ui/Badge';

/** Consistent heading for every step, so the flow feels like one thing. */
export function StepHeader({ eyebrow, title, sub, role }) {
  return (
    <header className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-violet-deep">
          {eyebrow}
        </span>
        {role ? <Badge tone="neutral">{role.short}</Badge> : null}
      </div>
      <h1 className="text-display-md font-extrabold text-ink">{title}</h1>
      {sub ? <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{sub}</p> : null}
    </header>
  );
}

export default StepHeader;
