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

/**
 * Formats a duration in seconds as an adaptive clock-style string for chart axes.
 * Unlike `formatDuration`, it rolls into hours once the duration reaches 3600s.
 * Below 3600s: "M:SS" (minutes not zero-padded, seconds zero-padded).
 * At/above 3600s: "H:MM:SS" (hours not zero-padded, minutes/seconds zero-padded).
 * Examples: 30 → "0:30", 2030 → "33:50", 7200 → "2:00:00"
 */
export function formatAxisDuration(sec: number): string {
  const totalSeconds = Math.round(sec);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
