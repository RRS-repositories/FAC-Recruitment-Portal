import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/**
 * Icon + title + body. The lift on hover is small on purpose: it signals the
 * card is a coherent object, without implying it is a button.
 */
export function FeatureCard({ icon, title, body, className }) {
  return (
    <div
      className={cn(
        'group h-full rounded-card bg-white p-6 shadow-card',
        'transition-transform duration-300 ease-brand hover:-translate-y-1',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-4 grid h-11 w-11 place-items-center rounded-control bg-lav text-violet-deep transition-colors duration-300 group-hover:bg-violet group-hover:text-white"
      >
        <Icon name={icon} size={21} />
      </span>
      <h3 className="text-[1.02rem] font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

export default FeatureCard;
