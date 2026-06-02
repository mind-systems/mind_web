import type { ActivityType } from '@/core/types';

export const MODULE_LABELS: Record<ActivityType, string> = {
  breath: 'Breath',
  meditation: 'Meditation',
};

export const MODULE_STYLES: Record<ActivityType, string> = {
  breath: 'bg-sky-50 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  meditation: 'bg-violet-50 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
};

/**
 * Display label for a module. Falls back to the raw `type` string for activity
 * types not yet present in MODULE_LABELS, so a new module never silently renders
 * as another module's label.
 */
export function moduleLabel(type: ActivityType): string {
  return MODULE_LABELS[type] ?? type;
}
