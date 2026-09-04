import { useEffect, useRef, useState } from 'react';

/**
 * Reports when a node first enters the viewport.
 *
 * One observer per node, disconnected as soon as it fires — a page with ~60
 * revealed elements therefore does zero scroll-handler work after first paint.
 * If IntersectionObserver is unavailable the node is treated as visible so the
 * content is never trapped behind a missing API.
 */
export function useInView({ threshold = 0.15, rootMargin = '0px 0px -60px 0px', once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}

export default useInView;
