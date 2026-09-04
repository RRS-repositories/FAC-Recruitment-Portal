import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Container from '@/components/ui/Container';
import Logo from '@/components/ui/Logo';
import Icon from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { primaryNav } from '@/data/navigation';
import { company } from '@/data/company';
import { useScrolled } from '@/hooks/useScrolled';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

/** Turns a nav entry into the `to` object react-router expects. */
function targetFor({ to, hash }) {
  return hash ? { pathname: to, hash: `#${hash}` } : { pathname: to };
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled(24);
  const location = useLocation();
  const menuId = useId();
  const panelRef = useRef(null);
  const burgerRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useLockBodyScroll(open);

  // Any route or section change closes the menu.
  useEffect(() => {
    close();
  }, [location.pathname, location.hash, close]);

  // Escape closes and returns focus to the control that opened the menu, so
  // keyboard users are never stranded at the top of the document.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        close();
        burgerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // Leaving the mobile breakpoint while open would otherwise strand the panel.
  useEffect(() => {
    if (!open) return undefined;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const onChange = (event) => {
      if (event.matches) close();
    };

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [open, close]);

  const linkClass =
    'text-[0.875rem] font-medium text-white/[0.78] no-underline transition-colors duration-200 hover:text-white';

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-gold/15 backdrop-blur-[10px]',
        'transition-[background-color,box-shadow] duration-300 ease-brand',
        scrolled ? 'bg-navy/[0.98] shadow-[0_8px_30px_rgba(8,19,43,0.35)]' : 'bg-navy/[0.96]',
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-brand focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy"
      >
        Skip to content
      </a>

      <Container className="flex h-[70px] items-center justify-between">
        <Logo onClick={close} />

        {/* Desktop navigation */}
        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex xl:gap-[26px]">
          {primaryNav.map((item) => (
            <Link key={item.label} to={targetFor(item)} className={linkClass}>
              {item.label}
            </Link>
          ))}

          <a
            href={company.phoneHref}
            className="flex items-center gap-2 text-[0.875rem] font-semibold text-white no-underline transition-colors duration-200 hover:text-gold"
          >
            <Icon name="phone" size={16} strokeWidth={2} />
            <span className="hidden xl:inline">{company.phone}</span>
            <span className="xl:hidden">Call</span>
          </a>

          <Link
            to="/enquire"
            className="rounded-brand bg-gold px-5 py-2.5 text-[0.875rem] font-semibold text-navy no-underline transition-colors duration-200 hover:bg-gold-light"
          >
            Enquire
          </Link>
        </nav>

        {/* Mobile trigger — 44×44 hit area, labelled and state-announcing. */}
        <button
          ref={burgerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="-mr-2 flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-brand lg:hidden"
        >
          <span
            className={cn(
              'block h-0.5 w-[22px] bg-white transition-transform duration-300 ease-brand',
              open && 'translate-y-[7px] rotate-45',
            )}
          />
          <span
            className={cn(
              'block h-0.5 w-[22px] bg-white transition-opacity duration-200',
              open && 'opacity-0',
            )}
          />
          <span
            className={cn(
              'block h-0.5 w-[22px] bg-white transition-transform duration-300 ease-brand',
              open && '-translate-y-[7px] -rotate-45',
            )}
          />
        </button>
      </Container>

      {/* Mobile panel. Height-animated so it slides rather than snapping.
          `invisible` (not just zero height) is what actually removes the closed
          panel's links from the tab order. */}
      <div
        id={menuId}
        ref={panelRef}
        aria-hidden={!open}
        className={cn(
          'overflow-hidden border-gold/25 bg-navy transition-[max-height,opacity,visibility] duration-300 ease-brand lg:hidden',
          open
            ? 'visible max-h-[calc(100vh-70px)] overflow-y-auto border-b opacity-100'
            : 'invisible max-h-0 opacity-0',
        )}
      >
        <nav aria-label="Mobile" className="flex flex-col px-5 pb-5 pt-2 sm:px-6">
          {primaryNav.map((item) => (
            <Link
              key={item.label}
              to={targetFor(item)}
              className="border-t border-white/[0.06] py-3.5 text-base font-medium text-white/[0.85] no-underline transition-colors duration-200 hover:text-gold"
            >
              {item.label}
            </Link>
          ))}

          <a
            href={company.phoneHref}
            className="flex items-center gap-2 border-t border-white/[0.06] py-3.5 text-base font-semibold text-white no-underline"
          >
            <Icon name="phone" size={18} strokeWidth={2} />
            {company.phone}
          </a>

          <Link
            to="/enquire"
            className="mt-3 rounded-brand bg-gold px-5 py-3.5 text-center text-base font-semibold text-navy no-underline transition-colors duration-200 hover:bg-gold-light"
          >
            Enquire
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
