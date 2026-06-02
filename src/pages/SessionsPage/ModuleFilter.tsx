import type { ActivityType } from '@/core/types';

export type FilterValue = 'all' | ActivityType;

interface ModuleFilterProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

const TABS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Breath', value: 'breath' },
  { label: 'Meditation', value: 'meditation' },
];

export function ModuleFilter({ value, onChange }: ModuleFilterProps) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={[
            'flex-1 py-2 text-sm font-medium transition-colors',
            value === tab.value
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'border-b-2 border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
