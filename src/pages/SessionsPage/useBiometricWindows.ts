import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '@/core/api/client';
import { logger } from '@/core/observe';
import type { SessionRun, BioSampleDto } from '@/core/types';

/**
 * Merges two ascending-timestamp-sorted BioSampleDto arrays into a new sorted array.
 * `incoming` is first sorted (it is bounded to ~windowSec of samples, so cheap),
 * then merged with `prev` via a standard two-pointer pass.
 * Returns a new array — does not mutate either input.
 */
function mergeSortedByTimestamp(
  prev: BioSampleDto[],
  incoming: BioSampleDto[],
): BioSampleDto[] {
  const sorted = [...incoming].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const result: BioSampleDto[] = [];
  let i = 0;
  let j = 0;
  while (i < prev.length && j < sorted.length) {
    if (new Date(prev[i].timestamp).getTime() <= new Date(sorted[j].timestamp).getTime()) {
      result.push(prev[i++]);
    } else {
      result.push(sorted[j++]);
    }
  }
  while (i < prev.length) result.push(prev[i++]);
  while (j < sorted.length) result.push(sorted[j++]);
  return result;
}

export interface UseBiometricWindowsOptions {
  windowSec: number;
  /**
   * Builds the API path for a given time range (epoch-ms). Responsible for
   * ISO-formatting and encodeURIComponent of its own query params.
   * Must be memoized by callers so requestWindows and the drain effect
   * identity stay stable across renders (preserves the "no EChart re-bind
   * per window" guarantee).
   */
  buildPath: (fromMs: number, toMs: number) => string;
}

export interface UseBiometricWindowsResult {
  samples: BioSampleDto[];
  requestWindows: (idxs: number[]) => void;
  isLoading: boolean;
  totalWindows: number;
  attemptedCount: number;
  allAttempted: boolean;
  failedCount: number;
}

/**
 * Generic progressive windowed loader for biometric data.
 * Windows load only when `requestWindows` is called — no automatic load on
 * mount or session switch. Callers drive loading by enqueuing specific window indices.
 * Deduplication is handled entirely in refs so `requestWindows` has a stable identity
 * across window loads.
 *
 * Intentionally bypasses React Query — re-selecting a session reloads its windows
 * from scratch (no cache). Accepted trade-off given the 413 constraint that makes
 * a single cached full-session fetch impossible.
 */
export function useBiometricWindows(
  session: SessionRun,
  opts: UseBiometricWindowsOptions,
): UseBiometricWindowsResult {
  const { windowSec, buildPath } = opts;
  const sessionStartMs = new Date(session.startedAt).getTime();
  const sessionEndMs = new Date(session.endedAt).getTime();
  const totalWindows = Math.ceil(session.durationSeconds / windowSec);

  const [samples, setSamples] = useState<BioSampleDto[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attemptedCount, setAttemptedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Dedup refs — stable identities, never trigger re-renders.
  // loadedRef: windows fetched OR permanently failed (attempted). inFlightRef: window
  // currently fetching. queuedSetRef: mirror of the queue state for O(1) dedup.
  const loadedRef = useRef(new Set<number>());
  const inFlightRef = useRef<number | null>(null);
  const queuedSetRef = useRef(new Set<number>());

  // Fetch-ID mechanism to reject stale responses from previous sessions or after unmount.
  const fetchIdRef = useRef(0);

  // requestWindows is stable across window loads — keyed on totalWindows only (changes on session switch).
  const requestWindows = useCallback(
    (idxs: number[]) => {
      const toEnqueue: number[] = [];
      for (const i of idxs) {
        if (
          i >= 0 &&
          i < totalWindows &&
          !loadedRef.current.has(i) &&
          inFlightRef.current !== i &&
          !queuedSetRef.current.has(i)
        ) {
          toEnqueue.push(i);
          queuedSetRef.current.add(i);
        }
      }
      if (toEnqueue.length > 0) {
        setQueue((q) => [...q, ...toEnqueue]);
      }
    },
    [totalWindows],
  );

  // Drain effect — pops one window from the queue and fetches it.
  // No cleanup returned: the fetchId mechanism guards stale responses so
  // an in-flight request from a prior effect run is safely ignored on completion.
  // React 18 automatic batching ensures setIsLoading(true) + setQueue(rest) commit
  // together, preventing a second drain run from starting while a fetch is in-flight.
  useEffect(() => {
    if (isLoading || queue.length === 0) return;

    const [idx, ...rest] = queue;
    queuedSetRef.current.delete(idx);
    inFlightRef.current = idx;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setQueue(rest);

    const myFetchId = ++fetchIdRef.current;

    // For idx > 0 add 1 ms so a sample exactly on a window boundary is not
    // returned by two adjacent windows (ms-resolution timestamps, no gap).
    const fromMs =
      idx === 0
        ? sessionStartMs
        : sessionStartMs + idx * windowSec * 1000 + 1;
    const toMs = Math.min(sessionStartMs + (idx + 1) * windowSec * 1000, sessionEndMs);

    // Skip degenerate window — can occur when durationSeconds > (endedAt - startedAt) / 1000
    // due to rounding or data drift, causing the last window's fromMs to exceed sessionEndMs.
    // Not a failure — no data to fetch. Intentionally does NOT increment failedCount
    // (unlike the .catch path), so callers can distinguish empty sessions from all-failed ones.
    if (fromMs >= toMs) {
      loadedRef.current.add(idx);
      inFlightRef.current = null;
      setAttemptedCount((c) => c + 1);
      setIsLoading(false);
      return;
    }

    apiFetch<BioSampleDto[]>(buildPath(fromMs, toMs))
      .then((data) => {
        if (fetchIdRef.current !== myFetchId) return;
        // Merge-insert keeps `samples` globally sorted ascending by timestamp.
        // This sorted-accumulation guarantee is the prerequisite for any future
        // incremental chart update. Do NOT replace this with ECharts appendData:
        // appendData tail-appends without sorting, so out-of-order window arrival
        // (e.g. zoom-driven loading) would produce an X-axis zigzag. Merge-insert
        // sidesteps that entirely.
        setSamples((prev) => mergeSortedByTimestamp(prev, data));
        loadedRef.current.add(idx);
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== myFetchId) return;
        // Soft error: mark as attempted so the drain loop does not retry forever.
        logger.error(`Failed to load biometric window ${idx} for session ${session.id}`, { err });
        loadedRef.current.add(idx);
        setFailedCount((c) => c + 1);
      })
      .finally(() => {
        if (fetchIdRef.current !== myFetchId) return;
        inFlightRef.current = null;
        setAttemptedCount((c) => c + 1);
        setIsLoading(false);
      });
  }, [queue, isLoading, sessionStartMs, sessionEndMs, windowSec, buildPath, session.id]);

  // Session-switch / unmount reset — invalidates any in-flight fetch and clears all state.
  // Windows load only on demand via requestWindows; nothing is enqueued here.
  // Note: a future variant which changes `windowSec` mid-session without a `session.id`
  // change would not re-key this reset — out of scope for W1, relevant to W2.
  useEffect(() => {
    // Invalidate any in-flight fetch from the previous session or render cycle.
    fetchIdRef.current++;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSamples([]);
    setIsLoading(false);
    setAttemptedCount(0);
    setFailedCount(0);
    loadedRef.current = new Set();
    inFlightRef.current = null;
    queuedSetRef.current = new Set();
    setQueue([]);

    return () => {
      // On session change or unmount, invalidate the currently in-flight fetch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      fetchIdRef.current++;
    };
  }, [session.id, totalWindows]);

  return { samples, requestWindows, isLoading, totalWindows, attemptedCount, failedCount, allAttempted: attemptedCount >= totalWindows };
}
