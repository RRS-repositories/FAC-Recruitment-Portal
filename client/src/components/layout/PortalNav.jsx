import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';

/**
 * The dark bar across every page. Deliberately minimal — a candidate mid
 * application has one job, and a full navigation invites them to wander off
 * before finishing.
 */
export function PortalNav({ right, className }) {
  return (
    <header className={cn('bg-ink px-5 py-3.5 text-white sm:px-8', className)}>
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4">
        <Link to="/" className="rounded focus-visible:ring-offset-ink">
          <Logo light />
        </Link>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}

export default PortalNav;
