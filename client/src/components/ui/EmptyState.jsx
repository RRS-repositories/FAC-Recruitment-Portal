import { Icon } from './Icon';
import { cn } from '@/lib/cn';

/** Says what is missing and what to do about it — never just "no results". */
export function EmptyState({ icon = 'search', title, body, action, className }) {
  return (
    <div className={cn('px-6 py-16 text-center', className)}>
      <span
        aria-hidden="true"
        className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-lav text-violet-deep"
      >
        <Icon name={icon} size={22} />
      </span>
      <p className="text-[1.05rem] font-semibold text-ink">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
