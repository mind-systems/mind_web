import { useRef, useCallback, useMemo, useEffect } from 'react';

// The biometric chart uses conditional merge: a full rebuild (notMerge: true) only when the
// set of present grids changes (structureSignature delta or first render); otherwise ECharts
// merges each series' data by stable id (notMerge: false), which avoids recreating every grid
// and axis on every chunk arrival. A structural change (new grid appearing — e.g. a BCI sensor
// that locks after warmup) still forces a full rebuild to avoid the creation-order axis
// cross-wiring that incremental merge would cause. The zoom.start/end values encoded in the
// option keep the current zoom window across both full rebuilds and incremental merges.
import { useQuery } from '@tanstack/react-query';
import { EChart } from '@/components/EChart';
import { apiFetch } from '@/core/api/client';
import { ModuleBadge } from '@/components/ModuleBadge';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import type { SessionRun, InstructionDto } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { buildSessionChartOption } from './chartOption';
import { sessionTitle } from './sessionTitle';
import { useBiometricChunks, CHUNK_SEC } from './useBiometricChunks';

interface SessionChartsProps {
  session: SessionRun;
}

export function SessionCharts({ session }: SessionChartsProps) {
  // No time window for instructions: on the offset axis a phase's wire timestamp can fall
  // outside [startedAt, endedAt] — the first `rest` is stamped ~0.5 s before startedAt
  // (origin/tap precedes the server's startedAt), so a `from=startedAt` lower bound makes
  // the API drop it. Instructions are tiny (one marker per phase), so the full set is safe
  // to fetch unfiltered; the [from, to) window is a biometrics-only (413-avoidance) concern.
  const {
    data: instructionsData,
    isLoading: instructionsLoading,
    isError: instructionsError,
  } = useQuery({
    queryKey: ['session-instructions', session.id],
    queryFn: () =>
      apiFetch<InstructionDto[]>(`/sessions/runs/${session.id}/instructions`),
  });

  const {
    biometrics,
    requestChunks,
    isLoading: isChunkLoading,
    totalChunks,
    allChunksAttempted,
  } = useBiometricChunks(session);

  // Tracks the current zoom window so each full rebuild re-applies it
  // instead of snapping back to full range (start: 0, end: 100).
  const zoomRef = useRef({ start: 0, end: 100 });

  // Tracks the previously-applied structure signature to detect when a new grid first appears.
  const prevSignatureRef = useRef<string | null>(null);

  // Stable callback — deps do NOT include any per-chunk state (loadedChunks is
  // intentionally absent), so the callback identity does not change as chunks arrive.
  // This prevents the EChart binding effect from re-running on every chunk load.
  // Enqueue every chunk overlapping a [start, end] window (percentages of the full
  // [0, durationSec] axis). Already-loaded/queued chunks are deduped by the loader.
  const requestWindowChunks = useCallback(
    (start: number, end: number) => {
      const durationSec = session.durationSeconds;
      const startSec = (start / 100) * durationSec;
      const endSec = (end / 100) * durationSec;
      const firstChunk = Math.floor(startSec / CHUNK_SEC);
      const lastChunk = Math.min(Math.floor(endSec / CHUNK_SEC), totalChunks - 1);
      const idxs: number[] = [];
      for (let i = firstChunk; i <= lastChunk; i++) idxs.push(i);
      requestChunks(idxs);
    },
    [session.durationSeconds, requestChunks, totalChunks],
  );

  const handleDataZoom = useCallback(
    (params: unknown) => {
      const p = params as {
        start?: number;
        end?: number;
        batch?: { start?: number; end?: number }[];
      };
      const start = p.batch?.[0]?.start ?? p.start ?? 0;
      const end = p.batch?.[0]?.end ?? p.end ?? 100;
      // Persist zoom so the next option rebuild preserves the current window.
      zoomRef.current = { start, end };
      requestWindowChunks(start, end);
    },
    [requestWindowChunks],
  );

  // Stable object — changes only when handleDataZoom changes (i.e. on session switch).
  const events = useMemo(() => ({ datazoom: handleDataZoom }), [handleDataZoom]);

  // Always computed — the builder handles empty arrays gracefully, and this ensures
  // height and gridCount are always derived from the same grid-presence logic as the rendered option.
  // zoomRef is read without being a dep: we want the latest zoom captured at rebuild time
  // without retriggering the memo on every zoom event.
  const { option, height, gridCount, structureSignature } = useMemo(
    () =>
      buildSessionChartOption(
        instructionsData ?? [],
        biometrics,
        session.startedAt,
        session.endedAt,
        // Reading the ref at rebuild time is intentional: it captures the latest zoom
        // window without subscribing the memo to every zoom event.
        // eslint-disable-next-line react-hooks/refs
        zoomRef.current,
      ),
    [instructionsData, biometrics, session.startedAt, session.endedAt],
  );

  // Full rebuild when the grid set changes; incremental merge otherwise.
  // True on first render (prevSignatureRef is null) and on any structural delta (new grid appeared).
  // eslint-disable-next-line react-hooks/refs
  const notMerge = prevSignatureRef.current !== structureSignature;

  // Show skeleton until instructions have loaded AND at least the first chunk is visible.
  // Chunk errors are soft (logged, never surfaced), so isError covers instructions only.
  const isLoading = instructionsLoading || (biometrics.length === 0 && isChunkLoading);
  const isError = instructionsError;

  // Keying isEmpty off gridCount + allChunksAttempted prevents permanently trapping sessions
  // whose biometric streams start after the first 30 s chunk (e.g. a BCI sensor that locks
  // after warm-up): the EChart must render so datazoom can fire and load later chunks.
  const isEmpty = !isLoading && !isError && gridCount === 0 && allChunksAttempted;

  // Load the initially-visible window up front (the whole session at the default 0–100%
  // zoom) instead of waiting for a datazoom interaction. Chunks still drain one at a time
  // in the loader, so this stays within the per-chunk 413 bound while filling the chart
  // without requiring a scroll. It also covers the "chunk 0 has no renderable data"
  // (gridCount 0) case: every chunk gets attempted, so allChunksAttempted resolves and the
  // empty state can settle.
  useEffect(() => {
    requestWindowChunks(zoomRef.current.start, zoomRef.current.end);
  }, [requestWindowChunks]);

  // Write the committed signature after each render so the next render's notMerge comparison
  // is correct. Writing in an effect (not during render) avoids the committed-render mismatch
  // that a render-phase write would cause under React StrictMode double-invocation.
  useEffect(() => {
    prevSignatureRef.current = structureSignature;
  }, [structureSignature]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <ModuleBadge type={session.activityType} />
        <span className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
          {sessionTitle(session)}
        </span>
        <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">{formatDate(session.startedAt)}</span>
        <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">{formatDuration(session.durationSeconds)}</span>
        {session.activityType === 'breath' && session.complexity != null && (
          <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">
            · Difficulty {session.complexity.toFixed(1)}
          </span>
        )}
        {/* Subtle indicator shown only after the first chunk is visible and more are loading */}
        {isChunkLoading && biometrics.length > 0 && (
          <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">Loading…</span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <SkeletonLoader />
        ) : isError ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-red-500">Failed to load session data</span>
          </div>
        ) : isEmpty ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-gray-400 dark:text-gray-500">No data for this session</span>
          </div>
        ) : (
          <EChart option={option} style={{ height, width: '100%' }} notMerge={notMerge} onEvents={events} />
        )}
      </div>
    </div>
  );
}
