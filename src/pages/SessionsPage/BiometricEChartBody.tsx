import { useRef, useMemo, useEffect, useState, useCallback } from 'react';

// The biometric chart uses conditional merge: a full rebuild (notMerge: true) only when the
// set of present grids changes (structureSignature delta or first render); otherwise ECharts
// merges each series' data by stable id (notMerge: false), which avoids recreating every grid
// and axis on every data update. A structural change (new grid appearing) still forces a full
// rebuild to avoid the creation-order axis cross-wiring that incremental merge would cause.
// The zoom.start/end values encoded in the option keep the current zoom window across rebuilds.
import { EChart } from '@/components/EChart';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { logger } from '@/core/observe';
import type { InstructionDto, BioSampleDto } from '@/core/types';
import { buildSessionChartOption } from './chartOption';
import { computeSpanSec, niceTimeInterval } from './bucketPolicy';
import { deriveView } from './deriveView';
import type { BaseProgressLike } from './deriveView';

interface InstructionsQueryLike {
  isPending: boolean;
  isError: boolean;
}

interface BiometricEChartBodyProps {
  startedAt: string;
  endedAt: string;
  instructions: InstructionDto[];
  instructionsQuery: InstructionsQueryLike;
  samples: BioSampleDto[];
  baseProgress: BaseProgressLike;
  zoomRef: React.MutableRefObject<{ start: number; end: number }>;
  onDataZoom?: (params: unknown) => void;
}

export function BiometricEChartBody({
  startedAt,
  endedAt,
  instructions,
  instructionsQuery,
  samples,
  baseProgress,
  zoomRef,
  onDataZoom,
}: BiometricEChartBodyProps) {
  // Tracks the previously-applied structure signature to detect when a new grid first appears.
  const prevSignatureRef = useRef<string | null>(null);

  const durationSec = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;

  // Tracks the current zoom-derived tick interval so each full rebuild re-applies it instead
  // of resetting the axis to ECharts' auto interval (mirrors zoomRef's role for the zoom window).
  const initialInterval = niceTimeInterval(computeSpanSec({ start: 0, end: 100 }, durationSec));
  const intervalRef = useRef(initialInterval);
  // Drives the EChart targeted merge; only updated when the snapped interval actually changes.
  const [liveInterval, setLiveInterval] = useState(initialInterval);

  // Always computed — the builder handles empty arrays gracefully, and this ensures
  // height and gridCount are always derived from the same grid-presence logic as the rendered option.
  // zoomRef is a stable object identity (the parent's useRef), so listing it as a dep is honest
  // and harmless — it never changes within a session, so it never retriggers the memo.
  const { option, height, gridCount, structureSignature } = useMemo(
    () =>
      buildSessionChartOption(
        instructions,
        samples,
        startedAt,
        endedAt,
        // Reading the ref at rebuild time is intentional: it captures the latest zoom
        // window without subscribing the memo to every zoom event.
        // eslint-disable-next-line react-hooks/refs
        zoomRef.current,
        // Same pattern as zoomRef: bake in the latest interval without subscribing the memo
        // to every zoom-driven interval change (that goes through EChart's targeted merge).
        // eslint-disable-next-line react-hooks/refs
        intervalRef.current,
      ),
    [instructions, samples, startedAt, endedAt, zoomRef],
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
  const view = deriveView(baseProgress, instructionsQuery, gridCount);

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

  // Always bound (independent of onDataZoom) so the zoom-driven interval keeps recomputing
  // even when the parent doesn't care about zoom-window persistence. Forwards to onDataZoom
  // first so the parent's zoomRef is updated before we read it below.
  const handleDataZoom = useCallback(
    (params: unknown) => {
      onDataZoom?.(params);
      const next = niceTimeInterval(computeSpanSec(zoomRef.current, durationSec));
      if (next !== intervalRef.current) {
        intervalRef.current = next;
        setLiveInterval(next);
      }
    },
    [onDataZoom, zoomRef, durationSec],
  );

  // Stable object — changes only when handleDataZoom changes (i.e. on session switch).
  const events = useMemo<Record<string, (params: unknown) => void>>(
    () => ({ datazoom: handleDataZoom }),
    [handleDataZoom],
  );

  return (
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
        <EChart
          option={option}
          style={{ height, width: '100%' }}
          notMerge={notMerge}
          onEvents={events}
          xAxisInterval={liveInterval}
        />
      )}
    </div>
  );
}
