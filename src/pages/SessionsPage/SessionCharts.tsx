import { useRef, useCallback, useEffect, useState } from 'react';
import { ModuleBadge } from '@/components/ModuleBadge';
import type { SessionRun, InstructionDto, BioSampleDto } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { sessionTitle } from './sessionTitle';
import { useBiometricWindowedBase } from './useBiometricWindowedBase';
import { useBiometricChunks, CHUNK_SEC } from './useBiometricChunks';
import { useBiometricAggregate } from './useBiometricAggregate';
import { useChartInstructions } from './useChartInstructions';
import { BiometricEChartBody } from './BiometricEChartBody';
import {
  computeSpanSec,
  computeBucketSec,
  shouldUseRaw,
  quantizeWindow,
} from './bucketPolicy';

interface SessionChartsProps {
  session: SessionRun;
}

// Stable empty-array reference so the `instructions` prop does not change identity on every
// render while the instructions query is pending — a fresh `[]` literal would re-run the
// child's option memo during the loading window.
const EMPTY_INSTRUCTIONS: InstructionDto[] = [];

// Single source of truth for the active high-res overlay.
// null → base only; 'raw' → raw chunk accumulation; 'agg' → finer aggregate window.
type Overlay =
  | { kind: 'raw' }
  | { kind: 'agg'; fromMs: number; toMs: number; bucketSec: number }
  | null;

export function SessionCharts({ session }: SessionChartsProps) {
  const instructionsQuery = useChartInstructions(session);

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
      <BiometricEChartBody
        startedAt={session.startedAt}
        endedAt={session.endedAt}
        instructions={instructionsQuery.data ?? EMPTY_INSTRUCTIONS}
        instructionsQuery={instructionsQuery}
        samples={samples}
        baseProgress={{
          samples: baseLoader.samples,
          allAttempted: baseLoader.allAttempted,
          failedCount: baseLoader.failedCount,
          totalWindows: baseLoader.totalWindows,
        }}
        zoomRef={zoomRef}
        onDataZoom={handleDataZoom}
      />
    </div>
  );
}
