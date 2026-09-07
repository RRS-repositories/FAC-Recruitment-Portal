/**
 * The project's icon set — inline SVG, no icon font, no network request.
 *
 * SVG rather than emoji throughout: emoji render differently on every platform
 * (and regional-indicator flags render as bare letter pairs on Windows), which
 * makes them unreliable as interface elements.
 *
 * Drawn on a 24×24 grid using `currentColor`, so colour comes from the parent.
 */
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M20 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="M15 10l7-4v12l-7-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 10v4M12 17.5v.5" />
    </>
  ),
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18-2.5-3-2.5-15 0-18z" />
    </>
  ),
  // The six practice areas. Drawn rather than reached for as emoji: emoji
  // render differently on every platform and cannot take the brand colour.
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  heart: (
    <path d="M12 20c-5-3.2-8-6.6-8-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 3.4-3 6.8-8 10z" />
  ),
  car: (
    <>
      <path d="M5 16v2M19 16v2" />
      <path d="M3 16v-3l2-5h14l2 5v3z" />
      <path d="M6.5 13h.01M17.5 13h.01" />
    </>
  ),
  gavel: (
    <>
      <path d="M14 4l6 6-3 3-6-6z" />
      <path d="M11.5 6.5L5 13l3 3 6.5-6.5" />
      <path d="M3 21h10" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M16 12h5v-3h-5a1.5 1.5 0 000 3z" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,

  /* Added for the admin shell: navigation, the user menu and signing out. */
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2a2 2 0 11-4 0V21a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.2A1.7 1.7 0 004.8 9a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.2a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  logOut: (
    <>
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M13 3H6a2 2 0 00-2 2v14a2 2 0 002 2h7" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 00-4-4H6a4 4 0 00-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 00-3-3.87" />
      <path d="M16 3.6a4 4 0 010 7.75" />
    </>
  ),
};

/**
 * `title` makes an icon meaningful to assistive tech. Without it the icon is
 * marked decorative — which is correct whenever adjacent text already says
 * what it means, and avoids a screen reader announcing the same thing twice.
 */
export function Icon({ name, title, size = 20, strokeWidth = 1.8, className, ...props }) {
  const paths = PATHS[name];
  if (!paths) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...props}
    >
      {paths}
    </svg>
  );
}

export default Icon;
