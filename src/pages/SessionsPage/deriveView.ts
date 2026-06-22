import type { BioSampleDto } from '@/core/types';

export interface BaseProgressLike {
  samples: BioSampleDto[];
  allAttempted: boolean;
  failedCount: number;
  totalWindows: number;
}

interface InstructionsQueryLike {
  isPending: boolean;
}

export type ViewKind = 'loading' | 'empty' | 'error' | 'ready';

export interface ViewState {
  kind: ViewKind;
  samples: BioSampleDto[];
}

/**
 * Pure discriminated view-state derivation for SessionCharts.
 * Replaces scattered isLoading / isError / isEmpty booleans with a single discriminated union.
 *
 * State machine (checks in priority order):
 * 1. loading — instructions still pending, OR no samples have arrived yet and not all windows
 *    have been attempted. The skeleton holds until the first window with data resolves (or until
 *    everything has been attempted). This also covers the gap where an early window resolved empty
 *    while later windows are still pending — it keeps the skeleton rather than briefly flashing an
 *    empty chart.
 * 2. error — all windows were attempted, all failed, and nothing loaded. Kept distinct from empty
 *    so a network failure does not show "No data".
 * 3. ready (samples) — any samples exist → render the chart immediately; later windows stream in
 *    via the note-30 structure-signature incremental rebuild.
 * 4. ready (grids-without-samples) — all windows attempted and at least one grid is present.
 *    Restores the render path for sessions with non-empty instruction grids but zero biometric
 *    samples (e.g. a breath session without a BCI: breath_phase instructions produce the hasPhases
 *    grid while cardio/nfb/emotions data is absent).
 * 5. empty — terminal default: settled with no error, no samples, and no grids.
 *    No input falls through to undefined.
 *
 * Instructions failure is treated as soft: it is NOT surfaced as an error kind here.
 * The caller is responsible for logging the instructions error and rendering biometrics
 * without the timeline.
 *
 * React-free and side-effect-free — no logger calls, no hooks.
 */
export function deriveView(
  base: BaseProgressLike,
  instructionsQuery: InstructionsQueryLike,
  gridCount: number,
): ViewState {
  // 1. loading — hold skeleton until instructions settle AND at least one window resolves with data.
  if (instructionsQuery.isPending || (base.samples.length === 0 && !base.allAttempted)) {
    return { kind: 'loading', samples: [] };
  }

  // 2. error — every window failed and nothing loaded.
  // Guard on totalWindows > 0 so a zero-duration session (totalWindows === 0) does not
  // vacuously satisfy failedCount(0) === totalWindows(0) and fall into error instead of empty.
  if (base.allAttempted && base.samples.length === 0 && base.totalWindows > 0 && base.failedCount === base.totalWindows) {
    return { kind: 'error', samples: [] };
  }

  // 3. ready — any samples present: open the chart on the first window.
  if (base.samples.length > 0) {
    return { kind: 'ready', samples: base.samples };
  }

  // 4. ready (grids-without-samples) — settled with instructions grids but no biometric data.
  if (base.allAttempted && gridCount > 0) {
    return { kind: 'ready', samples: base.samples };
  }

  // 5. empty — settled, no error, no samples, no grids.
  return { kind: 'empty', samples: [] };
}
