import { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile (spec §4).
 *
 * Renders nothing at all unless VITE_TURNSTILE_SITE_KEY is set, so the form
 * keeps working before anyone has been to the Cloudflare dashboard. The server
 * decides separately whether a token is required — a widget on the page is not
 * the protection; verifying the token is.
 *
 * The token is short-lived. `refresh-expired="auto"` renews it in place, and
 * `onToken(null)` on expiry disables the submit button rather than letting
 * somebody send a token the server is about to refuse.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** True when a captcha is configured, so callers can require a token. */
export const captchaConfigured = Boolean(SITE_KEY);

/** Loaded once per page, however many widgets ask for it. */
let scriptPromise = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    // Turned OFF explicitly, not merely left unset: a script created this way
    // is async by default. Turnstile refuses to run `ready()` on an
    // async-loaded script — it says so in the console and then renders nothing
    // at all, which looks exactly like a missing site key. `ready()` is what
    // keeps render() out of the gap where the API object exists but is not
    // usable yet, so it is worth keeping and loading the script plainly. The
    // script is small and injected after first paint; nothing is held up.
    script.async = false;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Could not load the checkbox.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({ onToken, className = '' }) {
  const holder = useRef(null);
  const widgetId = useRef(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!SITE_KEY) return undefined;

    let cancelled = false;

    const render = (turnstile) => {
      if (cancelled || !holder.current || widgetId.current !== null) return;
      widgetId.current = turnstile.render(holder.current, {
        sitekey: SITE_KEY,
        'refresh-expired': 'auto',
        callback: (token) => onToken(token),
        // Each of these means we no longer hold a usable token, and the caller
        // has to know that as clearly as it knows about a good one.
        'expired-callback': () => onToken(null),
        'timeout-callback': () => onToken(null),
        'error-callback': () => {
          onToken(null);
          setFailed('The checkbox could not load. Check your connection and reload the page.');
        },
      });
    };

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        // `ready` waits for the API the loader script fetches afterwards.
        if (typeof turnstile.ready === 'function') turnstile.ready(() => render(turnstile));
        else render(turnstile);
      })
      .catch((error) => {
        if (!cancelled) setFailed(error.message);
      });

    return () => {
      cancelled = true;
      // React 18 StrictMode mounts effects twice in development; without this
      // the second mount would leave an orphaned widget on the page.
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [onToken]);

  if (!SITE_KEY) return null;

  return (
    <div className={className}>
      <div ref={holder} />
      {failed ? (
        <p role="alert" className="mt-2 text-[0.82rem] font-medium text-danger">
          {failed}
        </p>
      ) : null}
    </div>
  );
}

export default Turnstile;
