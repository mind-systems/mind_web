/**
 * Windowed aggregate biometric overlay hook.
 *
 * This hook deliberately uses React Query, unlike useBiometricChunks which bypasses RQ to
 * avoid HTTP 413 errors on raw full-session loads. The windowed aggregate payload is small
 * (bounded by TARGET_BUCKETS buckets across the visible span), so the 413 rationale does not
 * apply here — RQ's cache, deduplication, cancellation, and clean { data, isFetching } surface
 * are all desirable and used by the M3 overlay layer.
 *
 * The caller is expected to pass a quantized window (from quantizeWindow in bucketPolicy.ts)
 * so that small pans within one quantized boundary collapse to a single cache entry, and
 * zooming back to a previously visited window is served instantly from the RQ cache.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import type { SessionRun, BioSampleDto } from '@/core/types';

export interface AggregateOverlay {
  fromMs: number;
  toMs: number;
  bucketSec: number;
}

export function useBiometricAggregate(session: SessionRun, overlay: AggregateOverlay | null) {
  return useQuery({
    queryKey: ['bio-agg', session.id, overlay?.fromMs, overlay?.toMs, overlay?.bucketSec],
    queryFn: () => {
      // overlay is guaranteed non-null when enabled: true; the cast is safe.
      const { fromMs, toMs, bucketSec } = overlay!;
      const from = encodeURIComponent(new Date(fromMs).toISOString());
      const to = encodeURIComponent(new Date(toMs).toISOString());
      return apiFetch<BioSampleDto[]>(
        `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}&bucketSec=${bucketSec}`,
      );
    },
    // Inert when no aggregate overlay is active — prevents spurious requests.
    enabled: overlay != null,
    // Keep the previous overlay visible while the next quantized window loads,
    // so the chart never blanks between aggregate refetches; the base bridges either way.
    placeholderData: keepPreviousData,
  });
}
