const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO date string as a compact "DD MMM, HH:mm" label in local time.
 * Example: "07 Apr, 14:35"
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

/**
 * Formats a duration in seconds as "mm:ss" (zero-padded).
 * Minutes may exceed 99 for long sessions.
 * Example: 452 → "07:32"
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
