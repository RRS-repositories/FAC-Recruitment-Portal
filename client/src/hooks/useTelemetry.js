import { useCallback, useEffect, useRef } from 'react';

/**
 * Captures the behavioural signals the AI-use check reads (build spec §13).
 *
 * Deliberately measures rather than blocks. Spec §13.5 is explicit that
 * disabling paste is trivially bypassed and punishes genuine candidates
 * pasting from their own notes — so paste is counted, not prevented.
 *
 * Nothing here identifies anyone: it is counters and elapsed seconds, sent
 * once with the application. It cannot be reconstructed after submission,
 * which is why it is collected now even though the scoring lands later.
 */
export function useTelemetry() {
  const state = useRef({
    pasteChars: 0,
    typedChars: 0,
    activeSecs: 0,
    tabSwitches: 0,
    writtenSecs: 0,
    stepTimes: {},
  });

  const lastKeyAt = useRef(0);
  const writtenEnteredAt = useRef(null);
  const stepEnteredAt = useRef({ step: null, at: 0 });

  // Tab and window switches, counted only while the flow is open.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') state.current.tabSwitches += 1;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const onPaste = useCallback((event) => {
    const text = event.clipboardData?.getData('text') ?? '';
    state.current.pasteChars += text.length;
  }, []);

  /**
   * Typing speed needs *active* seconds, not wall-clock: a candidate who
   * thinks for two minutes between sentences is not a slow typist. Gaps longer
   * than five seconds are treated as thinking and excluded.
   */
  const onKeyDown = useCallback((event) => {
    if (event.key.length !== 1) return; // ignore Shift, arrows, Backspace…
    const now = Date.now();
    state.current.typedChars += 1;
    if (lastKeyAt.current) {
      const gap = (now - lastKeyAt.current) / 1000;
      if (gap < 5) state.current.activeSecs += gap;
    }
    lastKeyAt.current = now;
  }, []);

  const enterWrittenStep = useCallback(() => {
    writtenEnteredAt.current = Date.now();
  }, []);

  const leaveWrittenStep = useCallback(() => {
    if (writtenEnteredAt.current) {
      state.current.writtenSecs += Math.round((Date.now() - writtenEnteredAt.current) / 1000);
      writtenEnteredAt.current = null;
    }
  }, []);

  /** Records how long each step took, for the expanded dashboard view. */
  const markStep = useCallback((step) => {
    const previous = stepEnteredAt.current;
    if (previous.step && previous.at) {
      state.current.stepTimes[previous.step] = Math.round((Date.now() - previous.at) / 1000);
    }
    stepEnteredAt.current = { step, at: Date.now() };
  }, []);

  const snapshot = useCallback(() => {
    markStep(null); // close the open step
    return {
      ...state.current,
      activeSecs: Math.round(state.current.activeSecs),
    };
  }, [markStep]);

  return { onPaste, onKeyDown, enterWrittenStep, leaveWrittenStep, markStep, snapshot };
}

export default useTelemetry;
