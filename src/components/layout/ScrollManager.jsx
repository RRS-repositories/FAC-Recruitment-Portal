import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * Restores sane scroll behaviour on top of client-side routing:
 *
 *  - a link carrying a hash scrolls that section under the fixed header;
 *  - a plain navigation starts the new page at the top;
 *  - a browser back/forward is left alone, so the position the user is
 *    returning to is not stolen from them.
 */
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const firstRender = isFirstRender.current;
    isFirstRender.current = false;

    // React Router reports the initial render as POP too, so the guard has to
    // let the first pass through — otherwise a shared link like /#industries
    // would land at the top of the page.
    if (navigationType === 'POP' && !firstRender) return undefined;

    // A fresh load with no hash is already at the top; scrolling there would
    // only fight the browser's own restoration on a refresh.
    if (firstRender && !hash) return undefined;

    const behavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (!hash) {
      window.scrollTo({ top: 0, behavior });
      return undefined;
    }

    // The target section may mount in the same commit as this effect, so wait
    // one frame before measuring it.
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior, block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [pathname, hash, navigationType, prefersReducedMotion]);

  return null;
}

export default ScrollManager;
