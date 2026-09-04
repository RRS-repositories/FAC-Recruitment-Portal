import { cn } from '@/lib/cn';

/**
 * Step progress for the application flow.
 *
 * Exposed as a real progressbar to assistive tech, and the visible "Step 2 of
 * 4" text carries the same information — so the position is never conveyed by
 * the coloured bar alone.
 */
export function ProgressBar({ current, total, className }) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[0.78rem] font-semibold uppercase tracking-wider text-violet-deep">
          Step {current} of {total}
        </span>
        <span className="text-[0.78rem] text-muted tabular">{Math.round(pct)}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current} of ${total}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-lav"
      >
        <div
          className="h-full rounded-full bg-cta transition-[width] duration-500 ease-brand"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
