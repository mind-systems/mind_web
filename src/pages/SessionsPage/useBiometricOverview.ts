/**
 * Full-session aggregated biometric overview hook.
 *
 * This hook deliberately uses React Query, unlike useBiometricChunks which bypasses RQ to
 * avoid HTTP 413 errors on raw full-session loads. The bucketed aggregate payload is small
 * (≈TARGET_BUCKETS buckets), so the 413 rationale does not apply here — RQ's cache,
 * deduplication, cancellation, and clean { data, isPending, isError } surface are all
 * desirable and used by the M2 base layer.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import type { SessionRun, BioSampleDto } from '@/core/types';
import { computeBucketSec } from './bucketPolicy';

export function useBiometricOverview(session: SessionRun) {
  const bucketSec = computeBucketSec(session.durationSeconds);
  const from = encodeURIComponent(session.startedAt);
  const to = encodeURIComponent(session.endedAt);

  return useQuery({
    queryKey: ['bio-overview', session.id],
    queryFn: () =>
      apiFetch<BioSampleDto[]>(
        `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}&bucketSec=${bucketSec}`,
      ),
  });
}
