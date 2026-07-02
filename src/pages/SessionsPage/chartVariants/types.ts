import type { ComponentType } from 'react';
import type { SessionRun } from '@/core/types';

/**
 * Contract every chart variant satisfies — a self-contained component selected by the
 * radio group in `VariantSelector`. Windowed algorithms (raw, min/max, ...) are built via
 * `makeWindowedVariant`; a future alternate renderer (e.g. lightweight-charts) would supply
 * its own `Component` while still satisfying this same contract.
 */
export interface ChartVariant {
  id: string;
  label: string;
  Component: ComponentType<{ session: SessionRun }>;
}
