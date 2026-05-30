import type { EChartsOption } from 'echarts';
import type { InstructionDto, BioSampleDto } from '@/core/types';
import { parsePhases, toSeries } from './transforms';

export const PHASE_COLORS: Record<string, string> = {
  inhale: '#5BAD6F',
  hold: '#4B9CD3',
  exhale: '#E89B2A',
  rest: '#9E9E9E',
};

// Layout constants (all in pixels)
const INSTRUCTION_HEIGHT = 80;
const DATA_HEIGHT = 160;
const GAP = 20;
const TOP = 50;
const LEFT = 60;
const RIGHT = 20;

// Minimal interface for the ECharts custom-series renderItem API.
// The actual runtime object is CustomSeriesRenderItemAPI from 'echarts'.
interface RenderItemAPI {
  value: (dim: number) => number;
  coord: (point: number[]) => number[];
  style: () => Record<string, unknown>;
}

function buildLineSeriesEntry(
  gridIndex: number,
  data: [number, number][],
  name: string,
  color: string,
) {
  return {
    type: 'line' as const,
    xAxisIndex: gridIndex,
    yAxisIndex: gridIndex,
    data,
    smooth: false,
    symbol: 'none',
    name,
    lineStyle: { color, width: 1.5 },
    itemStyle: { color },
  };
}

/**
 * Builds a fully self-contained EChartsOption and the matching canvas height for a session
 * detail panel. Up to four vertically-stacked grids are included (instruction phases always;
 * heart rate, EEG bands, and emotions only when their sample data is non-empty). Grid
 * presence is derived from the same toSeries calls that feed the option, so `height` is
 * always consistent with the rendered layout.
 * All X-axes are value-based and linked via dataZoom.
 */
export function buildSessionChartOption(
  instructions: InstructionDto[],
  biometrics: BioSampleDto[],
  startedAt: string,
  endedAt: string,
): { option: EChartsOption; height: number } {
  const durationSec =
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;

  // --- Data transforms ---
  const phases = parsePhases(instructions, startedAt, endedAt);

  const heartRateSeries = toSeries(biometrics, 'cardio', 'heartRate', startedAt);

  const deltaSeries = toSeries(biometrics, 'nfb', 'delta', startedAt);
  const thetaSeries = toSeries(biometrics, 'nfb', 'theta', startedAt);
  const alphaSeries = toSeries(biometrics, 'nfb', 'alpha', startedAt);
  const smrSeries = toSeries(biometrics, 'nfb', 'smr', startedAt);
  const betaSeries = toSeries(biometrics, 'nfb', 'beta', startedAt);

  const attentionSeries = toSeries(biometrics, 'emotions', 'attention', startedAt);
  const relaxationSeries = toSeries(biometrics, 'emotions', 'relaxation', startedAt);
  const cogLoadSeries = toSeries(biometrics, 'emotions', 'cognitiveLoad', startedAt);
  const cogCtrlSeries = toSeries(biometrics, 'emotions', 'cognitiveControl', startedAt);
  const selfCtrlSeries = toSeries(biometrics, 'emotions', 'selfControl', startedAt);

  // --- Presence flags ---
  const hasHeartRate = heartRateSeries.length > 0;
  const hasEeg =
    deltaSeries.length > 0 ||
    thetaSeries.length > 0 ||
    alphaSeries.length > 0 ||
    smrSeries.length > 0 ||
    betaSeries.length > 0;
  const hasEmotions =
    attentionSeries.length > 0 ||
    relaxationSeries.length > 0 ||
    cogLoadSeries.length > 0 ||
    cogCtrlSeries.length > 0 ||
    selfCtrlSeries.length > 0;

  // --- Dynamic grid index assignment ---
  // INSTRUCTION_GRID is always index 0.
  // Each optional grid occupies the next available index.
  let nextIdx = 0;
  const INSTRUCTION_GRID = nextIdx++;
  const HR_GRID = hasHeartRate ? nextIdx++ : undefined;
  const EEG_GRID = hasEeg ? nextIdx++ : undefined;
  const EMOT_GRID = hasEmotions ? nextIdx++ : undefined;
  const totalGrids = nextIdx;

  // --- Grid top-position computation ---
  const gridHeights = [
    INSTRUCTION_HEIGHT,
    ...(hasHeartRate ? [DATA_HEIGHT] : []),
    ...(hasEeg ? [DATA_HEIGHT] : []),
    ...(hasEmotions ? [DATA_HEIGHT] : []),
  ];

  const gridTops: number[] = [];
  let currentTop = TOP;
  for (const h of gridHeights) {
    gridTops.push(currentTop);
    currentTop += h + GAP;
  }

  // --- Grids ---
  const grids = gridHeights.map((height, i) => ({
    left: LEFT,
    right: RIGHT,
    top: gridTops[i],
    height,
  }));

  // --- X-axes (one per grid, value type, same domain) ---
  const xAxes = Array.from({ length: totalGrids }, (_, i) => ({
    type: 'value' as const,
    gridIndex: i,
    min: 0,
    max: durationSec,
    axisLabel: {
      show: i === totalGrids - 1,
      formatter: (v: number) => `${Math.round(v)}s`,
    },
    axisLine: { show: true, lineStyle: { color: '#e0e0e0' } },
    axisTick: { show: i === totalGrids - 1 },
    splitLine: { show: false },
  }));

  // --- Y-axes (1:1 correspondence with grids) ---
  const yAxes = [
    // Instruction grid — hidden, 0-1 scale for renderItem anchoring
    {
      type: 'value' as const,
      gridIndex: INSTRUCTION_GRID,
      min: 0,
      max: 1,
      show: false,
    },
    ...(HR_GRID !== undefined
      ? [
          {
            type: 'value' as const,
            gridIndex: HR_GRID,
            scale: true,
            name: 'BPM',
            nameTextStyle: { fontSize: 11, color: '#888' },
            axisLabel: { fontSize: 10, color: '#888' },
            splitLine: { show: true, lineStyle: { color: '#f5f5f5' } },
          },
        ]
      : []),
    ...(EEG_GRID !== undefined
      ? [
          {
            type: 'value' as const,
            gridIndex: EEG_GRID,
            scale: true,
            name: 'μV',
            nameTextStyle: { fontSize: 11, color: '#888' },
            axisLabel: { fontSize: 10, color: '#888' },
            splitLine: { show: true, lineStyle: { color: '#f5f5f5' } },
          },
        ]
      : []),
    ...(EMOT_GRID !== undefined
      ? [
          {
            type: 'value' as const,
            gridIndex: EMOT_GRID,
            scale: true,
            name: 'Score',
            nameTextStyle: { fontSize: 11, color: '#888' },
            axisLabel: { fontSize: 10, color: '#888' },
            splitLine: { show: true, lineStyle: { color: '#f5f5f5' } },
          },
        ]
      : []),
  ];

  // --- Series ---
  // Phase bars — custom series filling the full instruction-grid height.
  // Each item carries its own itemStyle.color so api.style() picks it up.
  const phaseSeries = {
    type: 'custom' as const,
    xAxisIndex: INSTRUCTION_GRID,
    yAxisIndex: INSTRUCTION_GRID,
    renderItem: (_params: unknown, api: RenderItemAPI) => {
      const startSec = api.value(0);
      const endSec = api.value(1);
      // coord maps [dataSec, dataY] → [pixelX, pixelY].
      // Y=1 is the top of the instruction grid, Y=0 is the bottom.
      const topLeft = api.coord([startSec, 1]);
      const bottomRight = api.coord([endSec, 0]);
      return {
        type: 'rect',
        shape: {
          x: topLeft[0],
          y: topLeft[1],
          width: Math.max(bottomRight[0] - topLeft[0], 1),
          height: Math.max(bottomRight[1] - topLeft[1], 1),
        },
        style: api.style(),
        z2: 0,
      };
    },
    data: phases.map((p) => ({
      value: [p.startSec, p.endSec],
      itemStyle: { color: PHASE_COLORS[p.phase] ?? '#ccc' },
    })),
    z: 2,
    // Suppress phase bars from the axis tooltip — start/end seconds are meaningless there.
    tooltip: { show: false },
  };

  const allSeries = [
    phaseSeries,
    ...(HR_GRID !== undefined
      ? [buildLineSeriesEntry(HR_GRID, heartRateSeries, 'Heart Rate', '#f88d8d')]
      : []),
    ...(EEG_GRID !== undefined
      ? [
          buildLineSeriesEntry(EEG_GRID, deltaSeries, 'delta', '#4B9CD3'),
          buildLineSeriesEntry(EEG_GRID, thetaSeries, 'theta', '#5BAD6F'),
          buildLineSeriesEntry(EEG_GRID, alphaSeries, 'alpha', '#E89B2A'),
          buildLineSeriesEntry(EEG_GRID, smrSeries, 'smr', '#C973C1'),
          buildLineSeriesEntry(EEG_GRID, betaSeries, 'beta', '#E96F6F'),
        ]
      : []),
    ...(EMOT_GRID !== undefined
      ? [
          buildLineSeriesEntry(EMOT_GRID, attentionSeries, 'attention', '#4B9CD3'),
          buildLineSeriesEntry(EMOT_GRID, relaxationSeries, 'relaxation', '#5BAD6F'),
          buildLineSeriesEntry(EMOT_GRID, cogLoadSeries, 'cognitiveLoad', '#E89B2A'),
          buildLineSeriesEntry(EMOT_GRID, cogCtrlSeries, 'cognitiveControl', '#C973C1'),
          buildLineSeriesEntry(EMOT_GRID, selfCtrlSeries, 'selfControl', '#E96F6F'),
        ]
      : []),
  ];

  const allXAxisIndices = Array.from({ length: totalGrids }, (_, i) => i);
  // currentTop = TOP + Σ(gridHeight + GAP); strip the trailing gap and add 60 for dataZoom.
  const height = currentTop - GAP + 60;

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        link: [{ xAxisIndex: 'all' }],
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: allSeries as EChartsOption['series'],
    dataZoom: [
      {
        type: 'inside' as const,
        xAxisIndex: allXAxisIndices,
        start: 0,
        end: 100,
      },
      {
        type: 'slider' as const,
        xAxisIndex: allXAxisIndices,
        bottom: 10,
        height: 30,
        start: 0,
        end: 100,
      },
    ],
  };

  return { option, height };
}
