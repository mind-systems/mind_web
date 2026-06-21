/**
 * Zoom-to-resolution policy for the biometric LOD system.
 * All values are starting points to tune against real sessions (e.g. the 389k-motion baseline).
 */

/** Target number of buckets across the visible span — balances resolution vs. payload size. */
export const TARGET_BUCKETS = 1200;

/** Allowed bucket sizes in seconds. computeBucketSec snaps up to the next ladder entry. */
export const BUCKET_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300];

/**
 * Span threshold (seconds) below which the chart switches from aggregated to raw.
 * Lower than EXIT to prevent mode flapping at the boundary (hysteresis).
 */
export const RAW_SPAN_LIMIT_ENTER = 90;

/**
 * Span threshold (seconds) above which the chart switches back from raw to aggregated.
 * Higher than ENTER to add hysteresis — micro-zoom at ~90–110 s does not flap loaders.
 */
export const RAW_SPAN_LIMIT_EXIT = 110;

/**
 * Converts a zoom window (percentages, 0–100) to the visible span in seconds.
 * Matches the requestWindowChunks percentage→seconds math so both paths share one zoom model.
 */
export function computeSpanSec(zoom: { start: number; end: number }, durationSec: number): number {
  return ((zoom.end - zoom.start) / 100) * durationSec;
}

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
 * Hysteresis-gated decision: should the chart use raw chunks for the current span?
 * Uses separate enter/exit thresholds to prevent flapping at the boundary.
 * When already in raw mode, stays raw until the span exceeds RAW_SPAN_LIMIT_EXIT.
 * When in aggregated mode, switches to raw only below RAW_SPAN_LIMIT_ENTER.
 */
export function shouldUseRaw(spanSec: number, currentlyRaw: boolean): boolean {
  if (currentlyRaw) return spanSec <= RAW_SPAN_LIMIT_EXIT;
  return spanSec <= RAW_SPAN_LIMIT_ENTER;
}

/**
 * Snaps a request window to `bucketSec` boundaries.
 * `from` is floored and `to` is ceiled to the nearest multiple of `bucketSec * 1000` ms.
 * This is the request-identity unit for M3's React-Query cache key:
 * small pans within one quantized window collapse to a single cache entry.
 */
export function quantizeWindow(fromMs: number, toMs: number, bucketSec: number): [number, number] {
  const step = bucketSec * 1000;
  return [Math.floor(fromMs / step) * step, Math.ceil(toMs / step) * step];
}
