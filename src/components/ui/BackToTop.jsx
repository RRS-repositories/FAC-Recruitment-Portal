import { cn } from '@/utils/cn';
import Icon from './Icon';
import { useScrolled } from '@/hooks/useScrolled';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * Appears once the user is well down a long page. Kept out of the tab order
 * while hidden, and clear of the iOS home indicator via `env(safe-area-inset)`.
 */
export function BackToTop() {
  const visible = useScrolled(900);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
      }
      style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      className={cn(
        'fixed right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full',
        'bg-navy text-gold shadow-lift transition-all duration-300 ease-brand',
        'hover:bg-navy-mid hover:text-gold-light focus-visible:outline-offset-4',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none invisible translate-y-3 opacity-0',
      )}
    >
      <Icon name="arrowUp" size={20} strokeWidth={2} />
    </button>
  );
}

export default BackToTop;
