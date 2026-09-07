import { cn } from '@/lib/cn';

/**
 * The waiting state for the admin screens.
 *
 * A spinner rather than a skeleton here on purpose: skeletons work when the
 * shape of what is coming is known and fixed, and these pages load a list
 * whose length nobody knows yet. A skeleton that guesses wrong reads as a
 * layout jumping around.
 *
 * `role="status"` with a real sentence inside, so a screen reader is told the
 * page is working rather than left in silence. The ring itself is decorative
 * and hidden from them.
 *
 * Under `prefers-reduced-motion` the rotation stops and the ring holds still —
 * still visibly a loading indicator, with the sentence doing the work.
 */
export function Spinner({ label = 'Loading', size = 28, className, centered = false }) {
  const ring = (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2.5"
        />
        {/* One quarter of the ring, so the rotation is legible. */}
        <path
          d="M21.5 12A9.5 9.5 0 0012 2.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span role="status" className="text-[0.9rem] text-muted">
        {label}
      </span>
    </span>
  );

  if (!centered) return ring;

  return (
    <div className="grid min-h-[16rem] place-items-center py-16 text-violet" aria-busy="true">
      {ring}
    </div>
  );
}

export default Spinner;
