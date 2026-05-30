import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { apiFetch } from '@/core/api/client';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import type { SessionRun, InstructionDto, BioSampleDto } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { buildSessionChartOption } from './chartOption';

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

  const isEmpty =
    !isLoading &&
    !isError &&
    (instructionsData?.length ?? 0) === 0 &&
    (biometricsData?.length ?? 0) === 0;

  // Always computed — the builder handles empty arrays gracefully, and this ensures
  // height is always derived from the same grid-presence logic as the rendered option.
  const { option, height } = useMemo(
    () =>
      buildSessionChartOption(
        instructionsData ?? [],
        biometricsData ?? [],
        session.startedAt,
        session.endedAt,
      ),
    [instructionsData, biometricsData, session.startedAt, session.endedAt],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-4">
        <span className="text-base font-semibold text-gray-900">
          {formatDate(session.startedAt)}
        </span>
        <span className="text-sm text-gray-400">{formatDuration(session.durationSeconds)}</span>
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
            <span className="text-sm text-gray-400">No data for this session</span>
          </div>
        ) : (
          <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
        )}
      </div>
    </div>
  );
}
