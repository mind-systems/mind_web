import { useCallback, useEffect } from 'react';
import type { SessionRun, BioSampleDto } from '@/core/types';
import { computeBucketSec } from './bucketPolicy';
import { useBiometricWindows } from './useBiometricWindows';

export interface UseBiometricWindowedBaseResult {
  samples: BioSampleDto[];
  isLoading: boolean;
  attemptedCount: number;
  allAttempted: boolean;
  failedCount: number;
  totalWindows: number;
}

/**
 * Aggregated biometric base loader that streams results window-by-window.
 * Replaces the single-request `useBiometricOverview` hook so the chart opens
 * on the FIRST resolved window instead of waiting for the full session.
 *
 * Window count targets ~8 (fast first paint, not dozens of tiny requests).
 * Window edges are snapped to the bucket grid so adjacent windows tile
 * contiguously under the server's half-open [from, to) semantics.
 *
 * Requires mind_api Phase 49 absolute bucket anchoring — buckets must be
 * anchored on epoch-grid multiples of bucketSec, not relative to each request's
 * `from`. Without it, adjacent windows produce misaligned bucket timestamps.
 */
export function useBiometricWindowedBase(session: SessionRun): UseBiometricWindowedBaseResult {
  const bucketSec = computeBucketSec(session.durationSeconds);
  const sessionEndMs = new Date(session.endedAt).getTime();

  // Target ~8 windows: snap ceil(durationSeconds / 8) up to the nearest multiple
  // of bucketSec so window edges sit on the bucket ladder (no window narrower than one bucket).
  const rawWindowSec = Math.ceil(session.durationSeconds / 8);
  const windowSec = Math.max(Math.ceil(rawWindowSec / bucketSec) * bucketSec, bucketSec);

  // buildPath quantizes raw [fromMs, toMs] ranges onto the absolute bucket grid:
  // - floor interior boundaries so window i's qTo equals window i+1's qFrom
  //   (contiguous, non-overlapping under [from, to) server semantics)
  // - ceil only the final window so the session's last partial bucket is not dropped
  // Memoized on [session.id, bucketSec, sessionEndMs] — W1 requires a stable buildPath
  // identity so requestWindows and the drain effect stay stable (no EChart re-bind per window).
  const buildPath = useCallback(
    (fromMs: number, toMs: number): string => {
      const step = bucketSec * 1000;
      const qFrom = Math.floor(fromMs / step) * step;
      const qTo =
        toMs >= sessionEndMs
          ? Math.ceil(toMs / step) * step
          : Math.floor(toMs / step) * step;
      const from = encodeURIComponent(new Date(qFrom).toISOString());
      const to = encodeURIComponent(new Date(qTo).toISOString());
      return `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}&bucketSec=${bucketSec}`;
    },
    [session.id, bucketSec, sessionEndMs],
  );

  const loader = useBiometricWindows(session, { windowSec, buildPath });

  // Auto-enqueue ALL windows on mount / session switch.
  // Keyed on session.id (not loader.requestWindows) — requestWindows is stable when
  // totalWindows is unchanged (~always 8), so keying on its identity would make this
  // effect skip re-running on a session switch, leaving the new session stuck on the skeleton.
  // requestWindows is internally deduped, so re-firing on the switch never double-enqueues.
  useEffect(() => {
    loader.requestWindows(Array.from({ length: loader.totalWindows }, (_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, loader.totalWindows]);

  return {
    samples: loader.samples,
    isLoading: loader.isLoading,
    attemptedCount: loader.attemptedCount,
    allAttempted: loader.allAttempted,
    failedCount: loader.failedCount,
    totalWindows: loader.totalWindows,
  };
}
