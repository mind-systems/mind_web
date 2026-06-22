import { useCallback } from 'react';
import type { SessionRun, BioSampleDto } from '@/core/types';
import { useBiometricWindows } from './useBiometricWindows';

export const CHUNK_SEC = 30;

interface UseBiometricChunksResult {
  biometrics: BioSampleDto[];
  requestChunks: (idxs: number[]) => void;
  isLoading: boolean;
  totalChunks: number;
  /** True once every chunk window has been fetched or permanently attempted (including errors). */
  allChunksAttempted: boolean;
}

/**
 * Fetches biometric data for a session in sequential 30-second chunks on demand.
 * Chunks load only when `requestChunks` is called — there is no automatic load on
 * mount or session switch. Callers drive loading by enqueuing specific chunk indices.
 * Deduplication is handled entirely in refs so `requestChunks` has a stable identity
 * across chunk loads.
 *
 * Intentionally bypasses React Query — re-selecting a session reloads its chunks
 * from scratch (no cache). Accepted trade-off given the 413 constraint that makes
 * a single cached full-session fetch impossible.
 */
export function useBiometricChunks(session: SessionRun): UseBiometricChunksResult {
  const buildPath = useCallback(
    (fromMs: number, toMs: number) => {
      const from = encodeURIComponent(new Date(fromMs).toISOString());
      const to = encodeURIComponent(new Date(toMs).toISOString());
      return `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}`;
    },
    [session.id],
  );

  const { samples, requestWindows, isLoading, totalWindows, allAttempted } =
    useBiometricWindows(session, { windowSec: CHUNK_SEC, buildPath });

  return {
    biometrics: samples,
    requestChunks: requestWindows,
    isLoading,
    totalChunks: totalWindows,
    allChunksAttempted: allAttempted,
  };
}
