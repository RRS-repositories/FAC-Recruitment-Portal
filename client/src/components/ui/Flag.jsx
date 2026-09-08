/**
 * Country flags, drawn rather than typed.
 *
 * The prototype used regional-indicator emoji (🇮🇳, 🇿🇦). Windows has no glyph
 * for those, so they render as the bare letter pairs "IN" and "ZA" — which is
 * exactly what the prototype's own screenshots show. Most of our candidates
 * apply from India and South Africa on Windows machines, so the one place the
 * flag matters is the one place it breaks.
 *
 * Two flags because we hire in two countries. A third is a few lines when
 * there is a third country, and until then this stays something a person can
 * read in one sitting.
 */

const FLAGS = {
  IN: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.333" fill="#f93" />
      <rect y="10.667" width="24" height="5.333" fill="#128807" />
      <circle cx="12" cy="8" r="2" fill="none" stroke="#008" strokeWidth="0.55" />
      <circle cx="12" cy="8" r="0.42" fill="#008" />
    </>
  ),
  ZA: (
    <>
      <rect width="24" height="16" fill="#002395" />
      <path d="M0 0h24v8H0z" fill="#de3831" />
      <path d="M0 0l9 8-9 8z" fill="#fff" />
      <path d="M0 1.6L7.2 8 0 14.4z" fill="#000" />
      <path d="M0 8h24" stroke="#fff" strokeWidth="4.6" />
      <path d="M6.6 8H24" stroke="#007a4d" strokeWidth="2.6" />
      <path d="M0 0.9l8.4 7.1L0 15.1" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M0 2.6l6.4 5.4L0 13.4" fill="none" stroke="#ffb612" strokeWidth="1.4" />
      <path d="M0 4.1l4.6 3.9L0 11.9z" fill="#000" />
    </>
  ),
};

/**
 * @param country ISO 3166-1 alpha-2, e.g. "IN". Unknown codes render nothing
 *   rather than a placeholder — a wrong flag is worse than no flag.
 */
export function Flag({ country, className, title }) {
  const art = FLAGS[String(country ?? '').toUpperCase()];
  if (!art) return null;

  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title || undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {art}
    </svg>
  );
}

export default Flag;
