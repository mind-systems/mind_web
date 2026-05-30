import ReactECharts from 'echarts-for-react';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import type { SessionRun, InstructionDto, BioSampleDto } from '@/core/types';
import { formatSessionDate, formatDuration } from './format';
import { buildSessionChartOption } from './chartOption';

interface SessionChartsProps {
  session: SessionRun;
  instructions: InstructionDto[];
  biometrics: BioSampleDto[];
  isLoading: boolean;
  isError: boolean;
}

export function SessionCharts({
  session,
  instructions,
  biometrics,
  isLoading,
  isError,
}: SessionChartsProps) {
  const isEmpty = !isLoading && !isError && instructions.length === 0 && biometrics.length === 0;

  // Always computed — the builder handles empty arrays gracefully, and this ensures
  // height is always derived from the same grid-presence logic as the rendered option.
  const { option, height } = buildSessionChartOption(
    instructions,
    biometrics,
    session.startedAt,
    session.endedAt,
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-4">
        <span className="text-base font-semibold text-gray-900">
          {formatSessionDate(session.startedAt)}
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
