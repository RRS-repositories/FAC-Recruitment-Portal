import { cn } from '@/lib/cn';

// Semantic tones are deliberately separate from the violet brand accent, so
// "this is a status" never reads as "this is branded".
const TONES = {
  neutral: 'bg-lav text-violet-deep',
  violet: 'bg-violet text-white',
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  quiet: 'bg-slate-100 text-slate-600',
};

/**
 * Status is encoded in shape and colour together — never colour alone, which
 * excludes anyone who cannot distinguish them.
 */
export function Badge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1',
        'text-[0.72rem] font-bold uppercase tracking-wide',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
