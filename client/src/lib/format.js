/**
 * Display formatting. Everything that turns data into something a human reads
 * lives here, so a change to date style happens once.
 */

/** "7m 42s" — the time-taken column in the dashboard. */
export function formatDuration(seconds) {
  if (seconds == null) return '—';

  // Rolls into hours. Without this a form left open overnight printed as
  // "951m 00s", which reads as a fault rather than as what it is: somebody who
  // opened the page, went away, and came back the next day. Past an hour the
  // seconds stop being interesting, so they are dropped.
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(total % 60).padStart(2, '0')}s`;
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (value) => dateTime.format(new Date(value));
export const formatDate = (value) => dateOnly.format(new Date(value));

/** Time of day in a specific zone — used to show a slot in two timezones. */
export function formatTimeIn(value, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

/** "Mon 6 Oct" in a specific zone. */
export function formatDayIn(value, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

/** Initials for an avatar, from a full name. */
export function initials(name) {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
