import { useCallback, useEffect, useMemo, useRef } from 'react';

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
/**
 * Whether an `inputType` represents somebody typing.
 *
 * Exported so it can be tested on its own, because getting it wrong is
 * expensive in one specific direction: `insertFromPaste` carries the WHOLE
 * pasted string, so counting it would read as somebody typing nine hundred
 * characters in a single instant -- precisely the pattern the typing-speed
 * signal treats as damning. Paste is already counted by `onPaste`.
 *
 * An empty `inputType` counts. Older browsers fire `input` without one, and
 * the alternative -- discarding it -- would silently reproduce the mobile bug
 * this function exists to fix.
 */
export function countsAsTyping(inputType) {
  if (typeof inputType !== 'string') return false;
  if (inputType === '') return true;
  if (inputType.startsWith('delete') || inputType.startsWith('history')) return false;
  if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') return false;
  if (inputType === 'insertFromPasteAsQuotation') return false;
  return inputType.startsWith('insert');
}

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
   * Counts characters as they are actually inserted.
   *
   * THIS USED TO LISTEN TO `keydown` AND FILTER ON `event.key.length !== 1`,
   * WHICH RECORDED NOTHING ON A PHONE. Android and iOS virtual keyboards go
   * through an input method, and `keydown` there reports `key: 'Unidentified'`
   * (or a bare keyCode 229) rather than the letter, so every character was
   * discarded by that filter. Measured on 240 live applications: 150 of 197
   * mobile applicants recorded zero typed characters, against 2 of 43 on
   * desktop. 82% of this pool applies from a phone.
   *
   * That was a fairness problem before it was a data problem — typing speed
   * could only ever count against a desktop applicant, so two candidates were
   * being judged by different signals. The `input` event fires for IME,
   * autocomplete and swipe input alike, and it carries an `inputType` saying
   * how the text arrived -- which is what makes it the right event here.
   *
   * Active seconds, not wall-clock: somebody who thinks for two minutes between
   * sentences is not a slow typist, so gaps over five seconds are treated as
   * thinking and excluded.
   */
  const onInput = useCallback((event) => {
    const native = event?.nativeEvent ?? event;
    if (!countsAsTyping(native?.inputType ?? '')) return;

    /*
     * One character per event, not `data.length`.
     *
     * A phone keyboard composing a word emits an event per keystroke whose
     * `data` is the whole word so far -- "h", "he", "hel", "hell", "hello" --
     * so adding the lengths would score five keystrokes as fifteen characters
     * and make an ordinary typist look impossibly fast. Counting the events
     * gives five, which is right. On a desktop `data` is a single character
     * anyway, so the two agree. Where this is wrong it under-counts, which
     * lowers the apparent speed and so can only ever be lenient.
     */
    const now = Date.now();
    state.current.typedChars += 1;
    if (lastKeyAt.current) {
      const gap = (now - lastKeyAt.current) / 1000;
      if (gap < 5) state.current.activeSecs += gap;
    }
    lastKeyAt.current = now;
  }, []);

  /**
   * Kept so existing callers that pass `onKeyDown` keep working unchanged.
   *
   * It no longer counts anything — `input` fires for the same keystrokes, and
   * counting in both would double every desktop character, which is exactly the
   * sort of silent drift that makes one applicant's number incomparable with
   * another's.
   */
  const onKeyDown = useCallback(() => {}, []);

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

  /**
   * Memoised, and that is load-bearing rather than an optimisation.
   *
   * Returning a fresh object literal made this hook's identity change on every
   * render. Callers put it in effect dependency arrays, so those effects
   * re-ran on every keystroke — one of them moved focus to the top of the
   * form, which made the field lose focus after a single character. Every
   * function below is already stable via useCallback; this makes the container
   * stable too.
   */
  return useMemo(
    () => ({ onPaste, onInput, onKeyDown, enterWrittenStep, leaveWrittenStep, markStep, snapshot }),
    [onPaste, onInput, onKeyDown, enterWrittenStep, leaveWrittenStep, markStep, snapshot],
  );
}

export default useTelemetry;
