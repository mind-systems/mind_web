import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '@/core/api/client';
import { logger } from '@/core/observe';
import type { SessionRun, BioSampleDto } from '@/core/types';

export const CHUNK_SEC = 30;

/**
 * Merges two ascending-timestamp-sorted BioSampleDto arrays into a new sorted array.
 * `incoming` is first sorted (it is bounded to ~CHUNK_SEC of samples, so cheap),
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

interface UseBiometricChunksResult {
  biometrics: BioSampleDto[];
  requestChunks: (idxs: number[]) => void;
  isLoading: boolean;
  totalChunks: number;
  /** True once every chunk window has been fetched or permanently attempted (including errors). */
  allChunksAttempted: boolean;
}

/**
 * Fetches biometric data for a session in sequential 30-second chunks.
 * Chunk 0 is loaded on mount; additional chunks are fetched on demand via
 * `requestChunks`. Deduplication is handled entirely in refs so `requestChunks`
 * has a stable identity across chunk loads.
 *
 * Intentionally bypasses React Query — re-selecting a session reloads its chunks
 * from scratch (no cache). Accepted trade-off given the 413 constraint that makes
 * a single cached full-session fetch impossible.
 */
export function useBiometricChunks(session: SessionRun): UseBiometricChunksResult {
  const sessionStartMs = new Date(session.startedAt).getTime();
  const sessionEndMs = new Date(session.endedAt).getTime();
  const totalChunks = Math.ceil(session.durationSeconds / CHUNK_SEC);

  const [biometrics, setBiometrics] = useState<BioSampleDto[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attemptedCount, setAttemptedCount] = useState(0);

  // Dedup refs — stable identities, never trigger re-renders.
  // loadedRef: chunks fetched OR permanently failed (attempted). inFlightRef: chunk
  // currently fetching. queuedSetRef: mirror of the queue state for O(1) dedup.
  const loadedRef = useRef(new Set<number>());
  const inFlightRef = useRef<number | null>(null);
  const queuedSetRef = useRef(new Set<number>());

  // Fetch-ID mechanism to reject stale responses from previous sessions or after unmount.
  const fetchIdRef = useRef(0);

  // requestChunks is stable across chunk loads — keyed on totalChunks only (changes on session switch).
  const requestChunks = useCallback(
    (idxs: number[]) => {
      const toEnqueue: number[] = [];
      for (const i of idxs) {
        if (
          i >= 0 &&
          i < totalChunks &&
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
    [totalChunks],
  );

  // Drain effect — pops one chunk from the queue and fetches it.
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

    // For idx > 0 add 1 ms so a sample exactly on a chunk boundary is not
    // returned by two adjacent chunks (ms-resolution timestamps, no gap).
    const fromMs =
      idx === 0
        ? sessionStartMs
        : sessionStartMs + idx * CHUNK_SEC * 1000 + 1;
    const toMs = Math.min(sessionStartMs + (idx + 1) * CHUNK_SEC * 1000, sessionEndMs);

    // Skip degenerate window — can occur when durationSeconds > (endedAt - startedAt) / 1000
    // due to rounding or data drift, causing the last chunk's fromMs to exceed sessionEndMs.
    if (fromMs >= toMs) {
      loadedRef.current.add(idx);
      inFlightRef.current = null;
      setAttemptedCount((c) => c + 1);
      setIsLoading(false);
      return;
    }

    const from = encodeURIComponent(new Date(fromMs).toISOString());
    const to = encodeURIComponent(new Date(toMs).toISOString());

    apiFetch<BioSampleDto[]>(
      `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}`,
    )
      .then((data) => {
        if (fetchIdRef.current !== myFetchId) return;
        // Merge-insert keeps `biometrics` globally sorted ascending by timestamp.
        // This sorted-accumulation guarantee is the prerequisite for any future
        // incremental chart update. Do NOT replace this with ECharts appendData:
        // appendData tail-appends without sorting, so out-of-order chunk arrival
        // (e.g. zoom-driven loading) would produce an X-axis zigzag. Merge-insert
        // sidesteps that entirely.
        setBiometrics((prev) => mergeSortedByTimestamp(prev, data));
        loadedRef.current.add(idx);
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== myFetchId) return;
        // Soft error: mark as attempted so the drain loop does not retry forever.
        logger.error(`Failed to load biometric chunk ${idx} for session ${session.id}`, { err });
        loadedRef.current.add(idx);
      })
      .finally(() => {
        if (fetchIdRef.current !== myFetchId) return;
        inFlightRef.current = null;
        setAttemptedCount((c) => c + 1);
        setIsLoading(false);
      });
  }, [queue, isLoading, session.id, sessionStartMs, sessionEndMs]);

  // Session-switch / unmount reset — invalidates any in-flight fetch and enqueues chunk 0.
  useEffect(() => {
    // Invalidate any in-flight fetch from the previous session or render cycle.
    fetchIdRef.current++;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBiometrics([]);
    setIsLoading(false);
    setAttemptedCount(0);
    loadedRef.current = new Set();
    inFlightRef.current = null;
    queuedSetRef.current = new Set();
    // Enqueue chunk 0 directly (refs just cleared, so dedup is clean).
    // Guard against zero-duration sessions where totalChunks === 0.
    if (totalChunks > 0) {
      queuedSetRef.current.add(0);
      setQueue([0]);
    }

    return () => {
      // On session change or unmount, invalidate the currently in-flight fetch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      fetchIdRef.current++;
    };
  }, [session.id, totalChunks]);

  return { biometrics, requestChunks, isLoading, totalChunks, allChunksAttempted: attemptedCount >= totalChunks };
}
