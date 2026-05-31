import type { ActivityType } from '@/core/types';

const LABELS: Record<ActivityType, string> = {
  breath: 'Breath',
  meditation: 'Meditation',
};

const STYLES: Record<ActivityType, string> = {
  breath: 'bg-sky-50 text-sky-700',
  meditation: 'bg-violet-50 text-violet-700',
};

interface ModuleBadgeProps {
  type: ActivityType;
}

export function ModuleBadge({ type }: ModuleBadgeProps) {
  const label = LABELS[type] ?? type;
  const style = STYLES[type] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {label}
    </span>
  );
}
