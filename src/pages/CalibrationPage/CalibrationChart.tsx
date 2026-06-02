import { useMemo } from 'react';
import { EChart } from '@/components/EChart';
import type { NfbCalibrationRecord } from '@/core/types';
import { buildCalibrationChartOption } from './chartOption';

interface CalibrationChartProps {
  deviceSerial: string;
  records: NfbCalibrationRecord[];
  validCount: number;
}

export function CalibrationChart({ deviceSerial, records, validCount }: CalibrationChartProps) {
  const option = useMemo(() => buildCalibrationChartOption(records), [records]);

  return (
    <section className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{deviceSerial}</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {validCount} / {records.length} valid
        </span>
      </div>
      <EChart
        option={option}
        style={{ height: 320, width: '100%' }}
        notMerge
      />
    </section>
  );
}
