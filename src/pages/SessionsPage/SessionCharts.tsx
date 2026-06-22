import { useRef, useCallback, useMemo, useEffect, useState } from 'react';

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
import type { SessionRun, InstructionDto, BioSampleDto } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { buildSessionChartOption } from './chartOption';
import { sessionTitle } from './sessionTitle';
import { useBiometricWindowedBase } from './useBiometricWindowedBase';
import { useBiometricChunks, CHUNK_SEC } from './useBiometricChunks';
import { useBiometricAggregate } from './useBiometricAggregate';
import { deriveView } from './deriveView';
import {
  computeSpanSec,
  computeBucketSec,
  shouldUseRaw,
  quantizeWindow,
} from './bucketPolicy';

interface SessionChartsProps {
  session: SessionRun;
}

// Single source of truth for the active high-res overlay.
// null → base only; 'raw' → raw chunk accumulation; 'agg' → finer aggregate window.
type Overlay =
  | { kind: 'raw' }
  | { kind: 'agg'; fromMs: number; toMs: number; bucketSec: number }
  | null;

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

  // Progressive windowed base: streams the full-session aggregate window-by-window so
  // the chart opens on the first resolved window instead of waiting for the full session.
  const baseLoader = useBiometricWindowedBase(session);

  // ── Overlay state (single source of truth for resolution mode) ──────────────────────────
  const [overlay, setOverlay] = useState<Overlay>(null);

  // Mirror into a ref so handleDataZoom can read the current overlay for hysteresis
  // without becoming a dependency (same pattern as zoomRef).
  const overlayRef = useRef<Overlay>(null);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  // Reset overlay on session change so a new session always starts on the base.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverlay(null);
  }, [session.id]);

  // ── Session scalars (stable within a session) ────────────────────────────────────────────
  const durationSec = session.durationSeconds;
  const startMs = new Date(session.startedAt).getTime();
  // Bucket size the base uses — used to detect when an overlay agg would be no finer.
  const baseBucketSec = computeBucketSec(durationSec);

  // ── Lazy raw chunks (loaded only on demand via requestWindowChunks) ──────────────────────
  const chunks = useBiometricChunks(session);
  const { requestChunks, biometrics: rawBiometrics, isLoading: chunksLoading } = chunks;

  // ── Aggregate overlay query (inert when overlay is not 'agg') ───────────────────────────
  const aggQuery = useBiometricAggregate(
    session,
    overlay?.kind === 'agg' ? overlay : null,
  );

  // Tracks the current zoom window so each full rebuild re-applies it
  // instead of snapping back to full range (start: 0, end: 100).
  const zoomRef = useRef({ start: 0, end: 100 });

  // Tracks the previously-applied structure signature to detect when a new grid first appears.
  const prevSignatureRef = useRef<string | null>(null);

  // Converts zoom percentages to chunk indices and enqueues them.
  // Called only on the raw path inside handleDataZoom — never on mount.
  // requestChunks is internally deduped, so re-calling per datazoom is safe.
  const requestWindowChunks = useCallback(
    (start: number, end: number) => {
      const fromIdx = Math.floor((start / 100) * durationSec / CHUNK_SEC);
      const toIdx = Math.floor((end / 100) * durationSec / CHUNK_SEC);
      const idxs: number[] = [];
      for (let i = fromIdx; i <= toIdx; i++) {
        idxs.push(i);
      }
      requestChunks(idxs);
    },
    [durationSec, requestChunks],
  );

  // Datazoom handler — persists zoom window and drives derived resolution switching.
  // Session scalars (startMs, durationSec, baseBucketSec) are deps but only change on
  // session switch, so handleDataZoom identity is stable within a session.
  const handleDataZoom = useCallback(
    (params: unknown) => {
      const p = params as {
        start?: number;
        end?: number;
        batch?: { start?: number; end?: number }[];
      };
      const start = p.batch?.[0]?.start ?? p.start ?? 0;
      const end = p.batch?.[0]?.end ?? p.end ?? 100;
      zoomRef.current = { start, end };

      // ── Derived resolution ─────────────────────────────────────────────────────────────
      const spanSec = computeSpanSec({ start, end }, durationSec);
      // Read overlay from ref so this callback does not need overlay as a dep.
      const currentlyRaw = overlayRef.current?.kind === 'raw';
      const useRaw = shouldUseRaw(spanSec, currentlyRaw);

      if (useRaw) {
        requestWindowChunks(start, end);
        // Functional form: no-op if already raw — prevents micro-zoom re-renders.
        setOverlay((prev) => (prev?.kind === 'raw' ? prev : { kind: 'raw' }));
      } else {
        const bucketSec = computeBucketSec(spanSec);
        if (bucketSec >= baseBucketSec) {
          // Overlay would be no finer than the base — clear it to avoid a redundant fetch.
          setOverlay(null);
        } else {
          const fromMs = startMs + (start / 100) * durationSec * 1000;
          const toMs = startMs + (end / 100) * durationSec * 1000;
          const [qFrom, qTo] = quantizeWindow(fromMs, toMs, bucketSec);
          // Functional form: no-op when the quantized window is identical (prevents a
          // re-fetch on micro-pans that stay within the same quantized bucket boundary).
          setOverlay((prev) => {
            if (
              prev?.kind === 'agg' &&
              prev.fromMs === qFrom &&
              prev.toMs === qTo &&
              prev.bucketSec === bucketSec
            ) {
              return prev;
            }
            return { kind: 'agg', fromMs: qFrom, toMs: qTo, bucketSec };
          });
        }
      }
    },
    [durationSec, startMs, baseBucketSec, requestWindowChunks],
  );

  // Stable object — changes only when handleDataZoom changes (i.e. on session switch).
  const events = useMemo(() => ({ datazoom: handleDataZoom }), [handleDataZoom]);

  // ── detail ?? base render ────────────────────────────────────────────────────────────────
  // base: coarse full-session aggregate (M2, always present after initial load).
  // detail: high-res overlay — raw accumulation or finer aggregate — when available.
  // detail is null whenever it has no renderable samples, so the chart never blanks:
  //   – during raw chunk fill the chart keeps showing base until chunks arrive.
  //   – during aggregate refetch placeholderData keeps the previous overlay; if no
  //     previous overlay exists, detail is null and base renders instead.
  const base = baseLoader.samples;
  const detail: BioSampleDto[] | null =
    overlay?.kind === 'raw' && rawBiometrics.length > 0
      ? rawBiometrics
      : overlay?.kind === 'agg' && (aggQuery.data?.length ?? 0) > 0
        ? aggQuery.data!
        : null;
  const samples = detail ?? base;

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

  // deriveView is driven by loader progress: loading/error reflect windowed base + instructions.
  // Overlay failures are soft — the base keeps rendering regardless.
  const view = deriveView(
    {
      samples: baseLoader.samples,
      allAttempted: baseLoader.allAttempted,
      failedCount: baseLoader.failedCount,
      totalWindows: baseLoader.totalWindows,
    },
    instructionsQuery,
    gridCount,
  );

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
        {/* Subtle indicator while base, aggregate overlay, or raw chunks are in-flight */}
        {(baseLoader.isLoading || aggQuery.isFetching || chunksLoading) && (
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
