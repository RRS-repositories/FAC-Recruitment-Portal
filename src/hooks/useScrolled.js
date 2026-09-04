import { useEffect, useState } from 'react';

/**
 * True once the page has scrolled past `offset`. Used to condense the navbar.
 *
 * The listener is passive and only ever flips a boolean, so React re-renders
 * at the threshold crossing rather than on every scroll frame.
 */
export function useScrolled(offset = 24) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > offset);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);

  return scrolled;
}

export default useScrolled;
