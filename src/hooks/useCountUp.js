import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Splits "20+" into { prefix: '', target: 20, suffix: '+' }. */
function parseStat(value) {
  const match = typeof value === 'string' ? value.match(/^(\D*)(\d+)(.*)$/) : null;
  if (!match) return { prefix: '', target: null, suffix: '' };
  return { prefix: match[1], target: Number(match[2]), suffix: match[3] };
}

/**
 * Counts a numeric stat up to its final value once `active` becomes true.
 *
 * Values here are authored strings like "20+", "7 days" or "3", so the leading
 * number is animated and any prefix/suffix is preserved verbatim. Non-numeric
 * values and reduced-motion users get the final string immediately.
 */
export function useCountUp(value, active, duration = 1100) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Destructured to primitives so the effect below has stable dependencies.
  const { prefix, target, suffix } = parseStat(value);

  const [display, setDisplay] = useState(() => (target === null ? value : `${prefix}0${suffix}`));
  const frameRef = useRef(0);

  useEffect(() => {
    if (target === null || !active || prefersReducedMotion) {
      setDisplay(value);
      return undefined;
    }

    const start = performance.now();
    // easeOutCubic — moves quickly, then settles gently on the final number.
    const ease = (t) => 1 - (1 - t) ** 3;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(`${prefix}${Math.round(ease(progress) * target)}${suffix}`);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [prefix, target, suffix, value, active, duration, prefersReducedMotion]);

  return display;
}

export default useCountUp;
