import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Splits "20+" into { prefix: '', target: 20, suffix: '+' }. */
function parseStat(value) {
  const match = typeof value === 'string' ? value.match(/^(\D*)(\d[\d,]*)(.*)$/) : null;
  if (!match) return { prefix: '', target: null, suffix: '' };
  return { prefix: match[1], target: Number(match[2].replace(/,/g, '')), suffix: match[3] };
}

/**
 * Counts a stat up once it is visible. Values are authored strings like "20+"
 * or "£4m+", so the leading number animates and any prefix or suffix is kept
 * verbatim. Non-numeric values and reduced-motion users get the final string
 * immediately — the number is the point, the animation is not.
 */
export function useCountUp(value, active, duration = 1000) {
  const reduced = useReducedMotion();
  const { prefix, target, suffix } = parseStat(value);
  const [display, setDisplay] = useState(() => (target === null ? value : `${prefix}0${suffix}`));
  const frame = useRef(0);

  useEffect(() => {
    if (target === null || !active || reduced) {
      setDisplay(value);
      return undefined;
    }

    const start = performance.now();
    const ease = (t) => 1 - (1 - t) ** 3;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(`${prefix}${Math.round(ease(progress) * target)}${suffix}`);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [prefix, target, suffix, value, active, duration, reduced]);

  return display;
}

export default useCountUp;
