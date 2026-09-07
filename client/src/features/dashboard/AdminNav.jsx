import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * The links across the top of every admin screen.
 *
 * Extracted at the third copy rather than the second: with a settings page as
 * well as applicants and emails, three navs drifting apart was a matter of
 * time, and a link missing from one screen is how a feature becomes invisible.
 *
 * Router links rather than plain anchors, so moving between admin screens does
 * not reload the whole app and lose the signed-in state on the way.
 */

const LINKS = [
  { key: 'applicants', to: '/admin', label: 'Applicants' },
  { key: 'templates', to: '/admin/templates', label: 'Emails' },
  { key: 'settings', to: '/admin/settings', label: 'Settings' },
];

const ITEM =
  'flex-shrink-0 rounded-control border px-3 py-1.5 text-[0.8rem] font-semibold transition-colors';

export function AdminNav({ current, email, onSignOut }) {
  return (
    // Wrapping rather than shrinking: three labels, a sign-out button and the
    // logo do not fit a 320px bar, and a link that scrolls off the edge is a
    // link nobody finds.
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {email ? (
        <span className="hidden max-w-[11rem] truncate text-[0.8rem] text-white/60 lg:inline lg:max-w-none">
          {email}
        </span>
      ) : null}

      {LINKS.map((link) => (
        <Link
          key={link.key}
          to={link.to}
          aria-current={link.key === current ? 'page' : undefined}
          className={cn(
            ITEM,
            link.key === current
              ? 'border-white/40 bg-white/15 text-white'
              : 'border-white/20 text-white hover:bg-white/10',
          )}
        >
          {link.label}
        </Link>
      ))}

      <button
        type="button"
        onClick={onSignOut}
        className={cn(ITEM, 'border-white/20 text-white hover:bg-white/10')}
      >
        Sign out
      </button>
    </div>
  );
}

export default AdminNav;
