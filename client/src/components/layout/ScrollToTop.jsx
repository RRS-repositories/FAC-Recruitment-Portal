import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Starts each new page at the top — but leaves back/forward alone, so
 * returning to a list does not steal the position someone had scrolled to.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, navigationType]);

  return null;
}

export default ScrollToTop;
