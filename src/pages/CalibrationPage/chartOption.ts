import type { EChartsOption } from 'echarts';
import type { NfbCalibrationRecord } from '@/core/types';
import { formatDate } from '@/core/format';

const VALID_COLOR = '#5BAD6F';
const INVALID_COLOR = '#E96F6F';
const TRANSPARENT = 'rgba(0,0,0,0)';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pointStyle(record: NfbCalibrationRecord) {
  if (record.isValid) {
    return {
      symbol: 'circle' as const,
      itemStyle: { color: VALID_COLOR, borderColor: VALID_COLOR },
    };
  }
  return {
    symbol: 'circle' as const,
    itemStyle: { color: TRANSPARENT, borderColor: INVALID_COLOR, borderWidth: 2 },
  };
}

/**
 * Builds a fully self-contained EChartsOption for one device's calibration history.
 * Input records must already be sorted chronologically (ascending by calibratedAt).
 */
export function buildCalibrationChartOption(records: NfbCalibrationRecord[]): EChartsOption {
  const categories = records.map((r) => formatDate(r.calibratedAt));

  const freqData = records.map((r) => ({
    value: r.individualFrequency,
    ...pointStyle(r),
  }));

  const powerData = records.map((r) => ({
    value: r.individualPeakFrequencyPower,
    ...pointStyle(r),
  }));

  const option: EChartsOption = {
    legend: {
      data: ['Individual Frequency (Hz)', 'Peak Power'],
      top: 8,
      left: 'center',
      textStyle: { fontSize: 12, color: '#555' },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const paramsArr = Array.isArray(params) ? params : [params];
        const dataIndex: number =
          paramsArr.length > 0 ? (paramsArr[0] as { dataIndex: number }).dataIndex : 0;
        const record = records[dataIndex];
        if (!record) return '';

        const date = formatDate(record.calibratedAt);
        const validity = record.isValid ? '✓ Valid' : '✗ Invalid';
        const failLine =
          record.failReason != null ? `<br/>Reason: ${escapeHtml(record.failReason)}` : '';

        const lines = paramsArr
          .map((p) => {
            const item = p as { seriesName: string; value: number; marker: string };
            return `${item.marker} ${item.seriesName}: <b>${item.value.toFixed(2)}</b>`;
          })
          .join('<br/>');

        return `${date}<br/>${validity}${failLine}<br/>${lines}`;
      },
    },
    grid: {
      left: 60,
      right: 60,
      top: 50,
      bottom: 40,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: 30,
        fontSize: 11,
        color: '#888',
      },
      axisLine: { lineStyle: { color: '#e0e0e0' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Hz',
        nameTextStyle: { fontSize: 11, color: '#888' },
        axisLabel: { fontSize: 10, color: '#888' },
        splitLine: { lineStyle: { color: '#f5f5f5' } },
      },
      {
        type: 'value',
        name: 'Power',
        nameTextStyle: { fontSize: 11, color: '#888' },
        axisLabel: { fontSize: 10, color: '#888' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Individual Frequency (Hz)',
        type: 'line',
        yAxisIndex: 0,
        data: freqData,
        lineStyle: { color: '#4B9CD3', width: 2 },
        symbolSize: 8,
      },
      {
        name: 'Peak Power',
        type: 'line',
        yAxisIndex: 1,
        data: powerData,
        lineStyle: { color: '#E89B2A', width: 2 },
        symbolSize: 8,
      },
    ],
  };

  return option;
}
