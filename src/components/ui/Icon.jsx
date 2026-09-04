/**
 * The project's icon set — inline SVG paths, no icon-font or runtime request.
 *
 * Every glyph is drawn on a 24×24 grid with `currentColor` strokes so colour is
 * controlled by the parent's text colour.
 */
const PATHS = {
  trendUp: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  savings: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  cube: <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  headset: (
    <path d="M4 10a6 6 0 0112 0v4a2 2 0 01-2 2h-1v-5h3M4 10v4a2 2 0 002 2h1v-5H4" />
  ),
  check: <path d="M5 12l4 4 10-10" />,
  phone: (
    <path d="M5 3h3l2 5-2.5 1.5a11 11 0 005 5L14 12l5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-3z" />
  ),
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
};

/** Glyphs authored on a grid other than 24×24. */
const VIEWBOXES = {
  headset: '0 0 20 20',
};

/**
 * `title` makes the icon meaningful to assistive tech; without it the icon is
 * marked decorative, which is correct whenever adjacent text already says what
 * it means.
 */
export function Icon({ name, title, size = 24, strokeWidth = 1.8, className, ...props }) {
  const paths = PATHS[name];
  if (!paths) return null;

  return (
    <svg
      viewBox={VIEWBOXES[name] ?? '0 0 24 24'}
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
