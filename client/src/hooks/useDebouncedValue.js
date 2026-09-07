import { useEffect, useState } from 'react';

/**
 * Trails a value by `delay` ms.
 *
 * The dashboard filters server-side, so the search box would otherwise fire a
 * query per keystroke — against an endpoint that is deliberately rate limited.
 * Debouncing the *value* rather than the request keeps the input itself
 * controlled and instantly responsive: what the manager types appears at once,
 * and only the fetch waits.
 */
export function useDebouncedValue(value, delay = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export default useDebouncedValue;
