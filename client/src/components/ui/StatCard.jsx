import { useInView } from '@/hooks/useInView';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';

/**
 * A single headline figure. Lifted onto its own card only where the number IS
 * the point — the landing hero and the dashboard summary — rather than as a
 * default decoration for any block of text.
 */
export function StatCard({ value, label, className }) {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const display = useCountUp(value, inView);

  return (
    <div ref={ref} className={cn('rounded-panel bg-white p-5 shadow-stat', className)}>
      <b className="block text-[1.75rem] font-black leading-none tracking-tight text-ink tabular">
        {display}
      </b>
      <span className="mt-2 block text-[0.8rem] font-medium text-muted">{label}</span>
    </div>
  );
}

export default StatCard;
