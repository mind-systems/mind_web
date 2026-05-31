import type { ActivityType } from '@/core/types';
import { MODULE_STYLES, moduleLabel } from './moduleMeta';

interface ModuleBadgeProps {
  type: ActivityType;
}

export function ModuleBadge({ type }: ModuleBadgeProps) {
  const style = MODULE_STYLES[type] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {moduleLabel(type)}
    </span>
  );
}
