/**
 * Zoom-to-resolution policy for the biometric LOD system.
 * All values are starting points to tune against real sessions (e.g. the 389k-motion baseline).
 */

/** Target number of buckets across the visible span — balances resolution vs. payload size. */
export const TARGET_BUCKETS = 1200;

/** Allowed bucket sizes in seconds. computeBucketSec snaps up to the next ladder entry. */
export const BUCKET_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300];

/**
 * Snaps `value` up to the smallest BUCKET_LADDER entry ≥ value.
 * Floors at ladder[0] (1 s) and caps at the last entry (300 s).
 */
export function snapUp(value: number, ladder = BUCKET_LADDER): number {
  for (const step of ladder) {
    if (step >= value) return step;
  }
  return ladder[ladder.length - 1];
}

/**
 * Computes the bucket size in seconds for a given visible span.
 * Snapping keeps `bucketSec` constant across small zoom moves (no refetch per pixel,
 * server-cache-friendly).
 */
export function computeBucketSec(spanSec: number): number {
  return snapUp(spanSec / TARGET_BUCKETS);
}

/**
 * Computes the visible span in seconds for a `{ start, end }` zoom window (0-100 percentages)
 * over a session of `durationSec` seconds. The single canonical span helper — callers must not
 * re-derive this math inline.
 */
export function computeSpanSec(zoom: { start: number; end: number }, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const span = ((zoom.end - zoom.start) / 100) * durationSec;
  return Number.isFinite(span) && span > 0 ? span : 0;
}

/** Allowed X-axis tick intervals in seconds, from sub-second-friendly to hour-scale. */
export const DURATION_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

/** Target tick count across the visible span — balances readability vs. clutter. */
export const TARGET_TICKS = 8;

/**
 * Picks a "nice" X-axis tick interval in seconds for a given visible span, targeting
 * ~6-10 ticks across the span. Snaps up to the next DURATION_LADDER entry.
 */
export function niceTimeInterval(spanSec: number): number {
  if (!Number.isFinite(spanSec) || spanSec <= 0) return 1;
  return snapUp(spanSec / TARGET_TICKS, DURATION_LADDER);
}
