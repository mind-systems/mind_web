import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SessionRun, InstructionDto } from '@/core/types';
import { useBiometricWindows } from '../useBiometricWindows';
import { useChartInstructions } from '../useChartInstructions';
import { BiometricEChartBody } from '../BiometricEChartBody';
import type { ChartVariant } from './types';

// Stable empty-array reference so the `instructions` prop does not change identity on every
// render while the instructions query is pending — a fresh `[]` literal would re-run the
// child's option memo during the loading window.
const EMPTY_INSTRUCTIONS: InstructionDto[] = [];

export interface WindowedVariantConfig {
  id: string;
  label: string;
  windowSec: (session: SessionRun) => number;
  buildPath: (session: SessionRun) => (fromMs: number, toMs: number) => string;
}

/**
 * Builds a self-contained `ChartVariant` from a windowing algorithm (raw, min/max, ...).
 * The returned `Component` owns its own progressive window loader, instructions query,
 * and zoom-window ref — remounted whole whenever the radio selection changes.
 */
export function makeWindowedVariant(config: WindowedVariantConfig): ChartVariant {
  function Component({ session }: { session: SessionRun }) {
    // Remount-on-switch (SessionCharts keys on `${session.id}:${selectedId}`) guarantees a
    // stable `session` identity within a mount, so these are effectively computed once.
    const windowSec = useMemo(() => config.windowSec(session), [session]);
    // windowSec is listed as a dep even though the callback body doesn't read it directly —
    // buildPath is derived from the same session-scoped inputs as windowSec, so recomputation
    // should track it even though both are effectively stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const buildPath = useMemo(() => config.buildPath(session), [session, windowSec]);

    const loader = useBiometricWindows(session, { windowSec, buildPath });

    // Auto-enqueue ALL windows on mount — requestWindows is internally deduped.
    useEffect(() => {
      loader.requestWindows(Array.from({ length: loader.totalWindows }, (_, i) => i));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.id, loader.totalWindows]);

    const instructionsQuery = useChartInstructions(session);

    // Tracks the current zoom window so each full rebuild re-applies it instead of
    // snapping back to full range (start: 0, end: 100). No resolution/overlay logic —
    // representation is now user-selected via the radio group, not zoom-derived.
    const zoomRef = useRef({ start: 0, end: 100 });
    const onDataZoom = useCallback((params: unknown) => {
      const p = params as {
        start?: number;
        end?: number;
        batch?: { start?: number; end?: number }[];
      };
      const start = p.batch?.[0]?.start ?? p.start ?? 0;
      const end = p.batch?.[0]?.end ?? p.end ?? 100;
      zoomRef.current = { start, end };
    }, []);

    return (
      <>
        {loader.isLoading && (
          <span className="shrink-0 px-6 pt-2 text-sm text-gray-400 dark:text-gray-500">Loading…</span>
        )}
        <BiometricEChartBody
          startedAt={session.startedAt}
          endedAt={session.endedAt}
          instructions={instructionsQuery.data ?? EMPTY_INSTRUCTIONS}
          instructionsQuery={instructionsQuery}
          samples={loader.samples}
          baseProgress={{
            samples: loader.samples,
            allAttempted: loader.allAttempted,
            failedCount: loader.failedCount,
            totalWindows: loader.totalWindows,
          }}
          zoomRef={zoomRef}
          onDataZoom={onDataZoom}
        />
      </>
    );
  }

  Component.displayName = `ChartVariant(${config.id})`;

  return { id: config.id, label: config.label, Component };
}
