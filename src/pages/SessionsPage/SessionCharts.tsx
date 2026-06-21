import { useRef, useCallback, useMemo, useEffect } from 'react';

// The biometric chart uses conditional merge: a full rebuild (notMerge: true) only when the
// set of present grids changes (structureSignature delta or first render); otherwise ECharts
// merges each series' data by stable id (notMerge: false), which avoids recreating every grid
// and axis on every data update. A structural change (new grid appearing) still forces a full
// rebuild to avoid the creation-order axis cross-wiring that incremental merge would cause.
// The zoom.start/end values encoded in the option keep the current zoom window across rebuilds.
import { useQuery } from '@tanstack/react-query';
import { EChart } from '@/components/EChart';
import { apiFetch } from '@/core/api/client';
import { logger } from '@/core/observe';
import { ModuleBadge } from '@/components/ModuleBadge';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import type { SessionRun, InstructionDto } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { buildSessionChartOption } from './chartOption';
import { sessionTitle } from './sessionTitle';
import { useBiometricOverview } from './useBiometricOverview';
import { deriveView } from './deriveView';

interface SessionChartsProps {
  session: SessionRun;
}

export function SessionCharts({ session }: SessionChartsProps) {
  // No time window for instructions: on the offset axis a phase's wire timestamp can fall
  // outside [startedAt, endedAt] — the first `rest` is stamped ~0.5 s before startedAt
  // (origin/tap precedes the server's startedAt), so a `from=startedAt` lower bound makes
  // the API drop it. Instructions are tiny (one marker per phase), so the full set is safe
  // to fetch unfiltered; the [from, to) window is a biometrics-only (413-avoidance) concern.
  const instructionsQuery = useQuery({
    queryKey: ['session-instructions', session.id],
    queryFn: () =>
      apiFetch<InstructionDto[]>(`/sessions/runs/${session.id}/instructions`),
  });

  // M2 base layer: single full-session aggregated request via React Query.
  // Payload is small (≈TARGET_BUCKETS buckets) so RQ cache + dedup + cancellation apply cleanly.
  const overviewQuery = useBiometricOverview(session);

  // Tracks the current zoom window so each full rebuild re-applies it
  // instead of snapping back to full range (start: 0, end: 100).
  const zoomRef = useRef({ start: 0, end: 100 });

  // Tracks the previously-applied structure signature to detect when a new grid first appears.
  const prevSignatureRef = useRef<string | null>(null);

  // Lightweight datazoom handler — M2 only persists the zoom window so zoom survives rebuilds.
  // M3 will reintroduce zoom-driven resolution switching here.
  const handleDataZoom = useCallback((params: unknown) => {
    const p = params as {
      start?: number;
      end?: number;
      batch?: { start?: number; end?: number }[];
    };
    const start = p.batch?.[0]?.start ?? p.start ?? 0;
    const end = p.batch?.[0]?.end ?? p.end ?? 100;
    zoomRef.current = { start, end };
  }, []);

  // Stable object — changes only when handleDataZoom changes (i.e. on session switch).
  const events = useMemo(() => ({ datazoom: handleDataZoom }), [handleDataZoom]);

  const samples = overviewQuery.data ?? [];

  // Always computed — the builder handles empty arrays gracefully, and this ensures
  // height and gridCount are always derived from the same grid-presence logic as the rendered option.
  // zoomRef is read without being a dep: we want the latest zoom captured at rebuild time
  // without retriggering the memo on every zoom event.
  const { option, height, gridCount, structureSignature } = useMemo(
    () =>
      buildSessionChartOption(
        instructionsQuery.data ?? [],
        samples,
        session.startedAt,
        session.endedAt,
        // Reading the ref at rebuild time is intentional: it captures the latest zoom
        // window without subscribing the memo to every zoom event.
        // eslint-disable-next-line react-hooks/refs
        zoomRef.current,
      ),
    [instructionsQuery.data, samples, session.startedAt, session.endedAt],
  );

  // Soft instructions error: log and continue — biometrics render without the timeline.
  // deriveView does not surface this as an 'error' kind; it only affects the instructions grid.
  useEffect(() => {
    if (instructionsQuery.isError) {
      logger.warn('Failed to load session instructions; rendering biometrics without timeline');
    }
  }, [instructionsQuery.isError]);

  const view = deriveView(overviewQuery, instructionsQuery, gridCount);

  // Full rebuild when the grid set changes; incremental merge otherwise.
  // True on first render (prevSignatureRef is null) and on any structural delta (new grid appeared).
  // eslint-disable-next-line react-hooks/refs
  const notMerge = prevSignatureRef.current !== structureSignature;

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
        {/* Subtle indicator while the single overview fetch is in-flight */}
        {overviewQuery.isFetching && (
          <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">Loading…</span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {view.kind === 'loading' ? (
          <SkeletonLoader />
        ) : view.kind === 'error' ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-red-500">Failed to load session data</span>
          </div>
        ) : view.kind === 'empty' ? (
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
