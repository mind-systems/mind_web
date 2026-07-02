import { useState } from 'react';
import { ModuleBadge } from '@/components/ModuleBadge';
import type { SessionRun } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { sessionTitle } from './sessionTitle';
import { VariantSelector } from './VariantSelector';
import { PeriodInput } from './PeriodInput';
import { CHART_VARIANTS, DEFAULT_VARIANT_ID } from './chartVariants/registry';

interface SessionChartsProps {
  session: SessionRun;
}

export function SessionCharts({ session }: SessionChartsProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_VARIANT_ID);
  // null = Auto (computeBucketSec derives the effective bucket). Intentionally not reset when
  // switching variants — switching algorithm keeps the period. No localStorage (local UI state).
  const [periodSec, setPeriodSec] = useState<number | null>(null);

  const variant = CHART_VARIANTS.find((v) => v.id === selectedId)!;
  const V = variant.Component;

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
        <VariantSelector variants={CHART_VARIANTS} value={selectedId} onChange={setSelectedId} />
        <PeriodInput
          value={periodSec}
          maxSec={session.durationSeconds}
          disabled={!variant.aggregated}
          onCommit={setPeriodSec}
        />
      </div>

      {/* Body */}
      <V session={session} bucketSec={periodSec} key={`${session.id}:${selectedId}:${periodSec ?? 'auto'}`} />
    </div>
  );
}
