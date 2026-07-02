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
