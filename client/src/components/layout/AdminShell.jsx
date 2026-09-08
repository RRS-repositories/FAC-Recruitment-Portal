import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { adminMe } from '@/lib/api';
import { cn } from '@/lib/cn';

/**
 * The frame every admin screen sits in.
 *
 * Three parts, each doing one job: a rail on the left for moving between
 * screens, a bar across the top for where you are and who you are, and the
 * content in the middle. The candidate-facing pages keep their own shell —
 * this one is for people who are working rather than visiting, so it trades
 * the marketing header and footer for navigation that is always in reach.
 *
 * On a phone the rail becomes a drawer over the content, because 16rem of a
 * 320px screen is half the page spent on navigation.
 */

const NAV = [
  { key: 'applicants', to: '/admin', label: 'Applicants', icon: 'users' },
  { key: 'calendar', to: '/admin/calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'templates', to: '/admin/templates', label: 'Emails', icon: 'mail' },
  { key: 'settings', to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

const COLLAPSE_KEY = 'fac.admin.railCollapsed';

/** Initials for the avatar, from an email or a name. */
const initialsOf = (value = '') => {
  const name = String(value)
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
};

export function AdminShell({
  current,
  title,
  subtitle,
  actions,
  email,
  onSignOut,
  loading,
  children,
}) {
  const location = useLocation();

  /*
   * Who is signed in.
   *
   * Asked for here rather than by each page, because every admin screen wants
   * it and only one of them had a reason to fetch it. Without this the avatar
   * fell back to "?" on two screens out of three, which reads as a fault
   * rather than as a missing prop.
   */
  const [whoami, setWhoami] = useState(email ?? '');
  useEffect(() => {
    if (email) {
      setWhoami(email);
      return undefined;
    }
    let cancelled = false;
    adminMe()
      .then(({ admin }) => {
        if (!cancelled) setWhoami(admin.email);
      })
      .catch(() => {
        // Not worth surfacing: each page already handles an expired session,
        // and an avatar is not the place to report one.
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  // Remembered between visits: someone who prefers the narrow rail should not
  // have to collapse it again on every page. A blocked storage API is not a
  // reason to fail — it just means the preference does not stick.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((was) => {
      const next = !was;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* preference simply will not persist */
      }
      return next;
    });
  }, []);

  // The drawer is navigation, so following a link has to close it. Without
  // this it stays open over the page you just asked for.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // Escape closes whichever is open, and a click outside closes the menu —
  // the two things anyone tries first.
  useEffect(() => {
    if (!menuOpen && !drawerOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      } else {
        setDrawerOpen(false);
      }
    };

    const onPointerDown = (event) => {
      if (!menuOpen) return;
      if (menuRef.current?.contains(event.target) || menuButtonRef.current?.contains(event.target))
        return;
      setMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuOpen, drawerOpen]);

  const railWidth = collapsed ? 'lg:w-[4.75rem]' : 'lg:w-64';

  const navList = (
    <ul className="grid gap-1 px-3">
      {NAV.map((item) => {
        const active = item.key === current;
        return (
          <li key={item.key}>
            <Link
              to={item.to}
              aria-current={active ? 'page' : undefined}
              // The label is the accessible name whether or not it is visible,
              // so a collapsed rail is still navigable by screen reader.
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-[0.9rem] font-medium transition-colors',
                collapsed && 'lg:justify-center lg:px-0',
                active
                  ? 'bg-white/[0.12] text-white'
                  : 'text-white/65 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              {/* A bar on the active item, so which screen you are on survives
                  the rail being collapsed to icons. */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-violet-hi transition-opacity',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Icon name={item.icon} size={19} className="flex-shrink-0" />
              <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const signOutButton = (
    <button
      type="button"
      onClick={onSignOut}
      aria-label="Sign out"
      title={collapsed ? 'Sign out' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-[0.9rem] font-medium text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white',
        collapsed && 'lg:justify-center lg:px-0',
      )}
    >
      <Icon name="logOut" size={19} className="flex-shrink-0" />
      <span className={cn(collapsed && 'lg:hidden')}>Sign out</span>
    </button>
  );

  return (
    <div className="bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>

      {/* The drawer's backdrop. Only ever on small screens; the rail is
          permanent from lg upwards. */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-30 bg-ink/50 lg:hidden animate-fade-in motion-reduce:animate-none"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* ── The rail ──────────────────────────────────────────────────── */}
      <nav
        aria-label="Admin sections"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink transition-[transform,width] duration-200 ease-brand motion-reduce:transition-none',
          railWidth,
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-16 flex-shrink-0 items-center gap-2 border-b border-white/10 px-4',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Link to="/admin" className={cn('min-w-0 rounded', collapsed && 'lg:hidden')}>
            <Logo light />
          </Link>
          {/* The mark alone once the rail is narrow — the wordmark would be
              clipped, and a clipped logo looks like a bug. */}
          <span
            aria-hidden="true"
            className={cn(
              'hidden h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-cta text-[0.8rem] font-bold text-white',
              collapsed && 'lg:grid',
            )}
          >
            FA
          </span>

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="ml-auto rounded-control p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">{navList}</div>

        {/* Pinned, and outside the scrolling area, so signing out is in the
            same place however long the list above ever gets. */}
        <div className="flex-shrink-0 border-t border-white/10 p-3">
          {signOutButton}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className={cn(
              'mt-1 hidden w-full items-center gap-3 rounded-control px-3 py-2 text-[0.82rem] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/80 lg:flex',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <Icon
              name={collapsed ? 'chevronRight' : 'chevronLeft'}
              size={18}
              className="flex-shrink-0"
            />
            <span className={cn(collapsed && 'lg:hidden')}>Collapse</span>
          </button>
        </div>
      </nav>

      {/* ── Everything to the right of the rail ───────────────────────── */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-brand motion-reduce:transition-none',
          collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-64',
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="rounded-control p-2 text-ink hover:bg-lav-soft lg:hidden"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.05rem] font-bold leading-tight text-ink">{title}</h1>
            {subtitle ? (
              <p className="hidden truncate text-[0.8rem] text-muted sm:block">{subtitle}</p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}

          <div className="relative flex-shrink-0">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-control py-1 pl-1 pr-1.5 transition-colors hover:bg-lav-soft"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-lav text-[0.75rem] font-bold text-violet-deep"
              >
                {initialsOf(whoami)}
              </span>
              <span className="sr-only">Account menu</span>
              <Icon
                name="chevronDown"
                size={15}
                className={cn('text-muted transition-transform', menuOpen && 'rotate-180')}
              />
            </button>

            {menuOpen ? (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] w-60 overflow-hidden rounded-card border border-line bg-white shadow-lift animate-pop-in motion-reduce:animate-none"
              >
                <div className="border-b border-line px-4 py-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                    Signed in as
                  </p>
                  <p className="mt-0.5 truncate text-[0.88rem] font-semibold text-ink">
                    {whoami || 'Manager'}
                  </p>
                </div>
                <Link
                  to="/admin/settings"
                  role="menuitem"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[0.88rem] text-ink hover:bg-lav-soft"
                >
                  <Icon name="settings" size={16} className="text-muted" />
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-[0.88rem] font-medium text-danger hover:bg-red-50"
                >
                  <Icon name="logOut" size={16} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-wide px-4 py-6 sm:px-6 sm:py-8">
            {loading ? <Spinner centered label="Loading…" /> : children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminShell;
