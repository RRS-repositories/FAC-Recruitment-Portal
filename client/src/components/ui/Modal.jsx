import { useEffect, useRef } from 'react';
import { Card } from './Card';
import { cn } from '@/lib/cn';

/**
 * A dialog that behaves like one.
 *
 * `role="dialog"` and `aria-modal` are a promise to assistive technology, and
 * an overlay that makes them without keeping to them is worse than no overlay:
 * a screen reader is told the rest of the page is inert while Tab walks
 * straight out of the dialog and into it.
 *
 * So this does the three things that promise implies — move focus in, keep Tab
 * inside, and put focus back where it came from on close — plus Escape, which
 * every keyboard user reaches for first.
 *
 * `dismissable` is false for a dialog whose content cannot be recovered once
 * it is gone. The booking link is shown exactly once: a stray Escape or a
 * misplaced click should not be able to lose it.
 */
export function Modal({ titleId, onClose, dismissable = true, className, children }) {
  const panel = useRef(null);
  const returnFocusTo = useRef(null);

  /**
   * Where focus came from, captured during render — before the effect below
   * moves it into the dialog.
   *
   * StrictMode runs effects twice in development (mount, clean up, mount).
   * Capturing this inside the effect meant the second run recorded whatever
   * the first run had already focused — a control *inside* the dialog — and
   * on close there was nothing connected to return to. The null guard makes
   * the capture happen once, no matter how many times React re-runs around it.
   */
  if (returnFocusTo.current === null) returnFocusTo.current = document.activeElement;

  /**
   * The props are read through a ref rather than depended on.
   *
   * Callers pass an inline arrow for `onClose`, which is a new function every
   * render. As a dependency it would re-run the effect on every render — and
   * the effect's first act is to record where focus came from, so it would
   * immediately re-record it as somewhere *inside* the dialog and lose the
   * real trigger. Reading the latest value from a ref keeps the effect to a
   * single run per open, which is what "on open" and "on close" mean.
   */
  const latest = useRef({ onClose, dismissable });
  latest.current = { onClose, dismissable };

  useEffect(() => {
    // The first focusable thing inside, or the panel itself — so focus is
    // never left behind on the button that opened the dialog.
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    (focusable()[0] ?? panel.current)?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && latest.current.dismissable) {
        event.stopPropagation();
        latest.current.onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends. Without this, Tab from the last control lands in
      // the page behind, which `aria-modal` has just told the user is not
      // there.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    // The page behind must not scroll under the overlay on touch.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;

      // By the time this runs the panel is already detached, so focus has
      // fallen back to <body>. That — and only that — is the case worth
      // repairing: if something else has deliberately taken focus, stealing it
      // back would be the bug.
      const lost = !document.activeElement || document.activeElement === document.body;
      if (!lost) return;

      const target = returnFocusTo.current;
      if (target?.isConnected) {
        target.focus?.();
        return;
      }

      // The control that opened the dialog can be gone — accepting an
      // applicant removes their accept button. Landing on <main> keeps a
      // keyboard user in the content instead of back at the top of the
      // document.
      const main = document.getElementById('main');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-5 animate-fade-in motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        // Only a click on the backdrop itself, not one that started inside the
        // panel and drifted out while selecting text.
        if (dismissable && event.target === event.currentTarget) onClose?.();
      }}
    >
      <Card
        ref={panel}
        tabIndex={-1}
        className={cn('w-full animate-pop-in outline-none motion-reduce:animate-none', className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </Card>
    </div>
  );
}

export default Modal;
