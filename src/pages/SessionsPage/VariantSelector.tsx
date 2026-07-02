import type { ChartVariant } from './chartVariants/types';

interface VariantSelectorProps {
  variants: ChartVariant[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Presentational radio group for picking the active chart variant. Purely controlled —
 * no data fetching, no storage. Selecting a radio remounts the variant subtree in the
 * shell (`SessionCharts`), which owns the `value`/`onChange` state.
 */
export function VariantSelector({ variants, value, onChange }: VariantSelectorProps) {
  return (
    <div role="radiogroup" className="ml-auto flex shrink-0 items-center gap-3 text-sm">
      {variants.map((variant) => (
        <label
          key={variant.id}
          className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300"
        >
          <input
            type="radio"
            name="chart-variant"
            value={variant.id}
            checked={value === variant.id}
            onChange={() => onChange(variant.id)}
            className="h-3.5 w-3.5 accent-blue-600"
          />
          {variant.label}
        </label>
      ))}
    </div>
  );
}
