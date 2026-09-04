/**
 * Display formatting. Everything that turns data into something a human reads
 * lives here, so a change to date style happens once.
 */

/** "7m 42s" — the time-taken column in the dashboard. */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
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
