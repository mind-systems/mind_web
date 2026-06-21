import type { BioSampleDto } from '@/core/types';

interface OverviewQueryLike {
  data?: BioSampleDto[];
  isPending: boolean;
  isError: boolean;
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
 * - loading: overview or instructions still pending — loading wins before empty/ready
 * - error:   overview fetch failed (kept distinct from empty — fixes "failed fetch shows No data" bug)
 * - empty:   overview settled, no error, and no renderable grids (gridCount === 0).
 *            No sessionHasData flag needed — the base is always the full-session result,
 *            never sub-windowed, so its zero-grid state IS the session's emptiness.
 * - ready:   otherwise; samples carries the overview data
 *
 * Instructions failure is treated as soft: it is NOT surfaced as an error kind here.
 * The caller is responsible for logging the instructions error and rendering biometrics
 * without the timeline.
 *
 * React-free and side-effect-free — no logger calls, no hooks.
 */
export function deriveView(
  overviewQuery: OverviewQueryLike,
  instructionsQuery: InstructionsQueryLike,
  gridCount: number,
): ViewState {
  if (overviewQuery.isPending || instructionsQuery.isPending) {
    return { kind: 'loading', samples: [] };
  }

  if (overviewQuery.isError) {
    return { kind: 'error', samples: [] };
  }

  if (gridCount === 0) {
    return { kind: 'empty', samples: [] };
  }

  return { kind: 'ready', samples: overviewQuery.data ?? [] };
}
