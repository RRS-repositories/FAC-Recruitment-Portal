import { cn } from '@/lib/cn';

/**
 * Fast Action Claims mark. The tile is decorative — the adjacent wordmark
 * already names the firm, so announcing it again would just be noise.
 */
export function Logo({ light = false, subtitle = 'SRA-regulated solicitors · UK', className }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-cta text-[0.8rem] font-black text-white"
      >
        FA
      </span>
      <span className="leading-tight">
        <span className={cn('block text-[0.98rem] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
          Fast Action Claims
        </span>
        <span
          className={cn(
            'block text-[0.62rem] font-bold uppercase tracking-[0.06em]',
            light ? 'text-white/55' : 'text-muted',
          )}
        >
          {subtitle}
        </span>
      </span>
    </span>
  );
}

export default Logo;
