import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EChart } from '@/components/EChart';
import { apiFetch } from '@/core/api/client';
import { ModuleBadge } from '@/components/ModuleBadge';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import type { SessionRun, InstructionDto, BioSampleDto } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { buildSessionChartOption } from './chartOption';
import { sessionTitle } from './sessionTitle';

interface SessionChartsProps {
  session: SessionRun;
}

export function SessionCharts({ session }: SessionChartsProps) {
  const from = encodeURIComponent(session.startedAt);
  const to = encodeURIComponent(session.endedAt);

  const {
    data: instructionsData,
    isLoading: instructionsLoading,
    isError: instructionsError,
  } = useQuery({
    queryKey: ['session-instructions', session.id],
    queryFn: () =>
      apiFetch<InstructionDto[]>(
        `/sessions/runs/${session.id}/instructions?from=${from}&to=${to}`,
      ),
  });

  const {
    data: biometricsData,
    isLoading: biometricsLoading,
    isError: biometricsError,
  } = useQuery({
    queryKey: ['session-biometrics', session.id],
    queryFn: () =>
      apiFetch<BioSampleDto[]>(
        `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}`,
      ),
  });

  const isLoading = instructionsLoading || biometricsLoading;
  const isError = instructionsError || biometricsError;

  // Always computed — the builder handles empty arrays gracefully, and this ensures
  // height and gridCount are always derived from the same grid-presence logic as the rendered option.
  const { option, height, gridCount } = useMemo(
    () =>
      buildSessionChartOption(
        instructionsData ?? [],
        biometricsData ?? [],
        session.startedAt,
        session.endedAt,
      ),
    [instructionsData, biometricsData, session.startedAt, session.endedAt],
  );

  // Keying isEmpty off gridCount rather than raw array lengths correctly handles sessions
  // that have instructions but no renderable grids (e.g. meditation without a BCI device —
  // instructions are session_event type, so no breath phases and no biometrics → gridCount === 0).
  const isEmpty = !isLoading && !isError && gridCount === 0;

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
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <SkeletonLoader />
        ) : isError ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-red-500">Failed to load session data</span>
          </div>
        ) : isEmpty ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-gray-400 dark:text-gray-500">No data for this session</span>
          </div>
        ) : (
          <EChart option={option} style={{ height, width: '100%' }} notMerge />
        )}
      </div>
    </div>
  );
}
