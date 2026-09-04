/**
 * Small inline SVG flags, drawn on a 24×16 (3:2) grid.
 *
 * Regional-indicator flag emoji (🇦🇪) are not rendered as flags by Windows or
 * by most Chromium builds — they fall back to the bare letter pair "AE", which
 * reads as a rendering fault. Inline SVG looks identical on every platform.
 * Simplified for legibility at ~28px; these are identity cues, not heraldry.
 */
const FLAGS = {
  AE: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect x="6" width="18" height="5.34" fill="#00732f" />
      <rect x="6" y="10.66" width="18" height="5.34" fill="#000" />
      <rect width="6" height="16" fill="#ff0000" />
    </>
  ),
  IN: (
    <>
      <rect width="24" height="5.34" fill="#ff9933" />
      <rect y="5.34" width="24" height="5.32" fill="#fff" />
      <rect y="10.66" width="24" height="5.34" fill="#138808" />
      <circle cx="12" cy="8" r="2" fill="none" stroke="#000080" strokeWidth="0.55" />
      <circle cx="12" cy="8" r="0.5" fill="#000080" />
    </>
  ),
  ZA: (
    <>
      <rect width="24" height="8" fill="#de3831" />
      <rect y="8" width="24" height="8" fill="#002395" />
      <path d="M0 0L10 8H24" fill="none" stroke="#fff" strokeWidth="5.2" />
      <path d="M0 16L10 8" fill="none" stroke="#fff" strokeWidth="5.2" />
      <path d="M0 0L10 8H24" fill="none" stroke="#007a4d" strokeWidth="3" />
      <path d="M0 16L10 8" fill="none" stroke="#007a4d" strokeWidth="3" />
      <path d="M0 -1.5L9.8 8 0 17.5z" fill="#ffb612" />
      <path d="M0 1L7.4 8 0 15z" fill="#000" />
    </>
  ),
  PH: (
    <>
      <rect width="24" height="8" fill="#0038a8" />
      <rect y="8" width="24" height="8" fill="#ce1126" />
      <path d="M0 0L13.9 8 0 16z" fill="#fff" />
      <circle cx="4.4" cy="8" r="1.7" fill="#fcd116" />
      <circle cx="1.3" cy="1.6" r="0.7" fill="#fcd116" />
      <circle cx="1.3" cy="14.4" r="0.7" fill="#fcd116" />
      <circle cx="11.4" cy="8" r="0.7" fill="#fcd116" />
    </>
  ),
};

/**
 * Decorative by default — the country name is always written out beside it, so
 * announcing the flag as well would just repeat the same information.
 */
export function Flag({ code, className }) {
  const shapes = FLAGS[code];
  if (!shapes) return null;

  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {shapes}
    </svg>
  );
}

export default Flag;
