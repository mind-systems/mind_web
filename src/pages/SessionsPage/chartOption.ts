import type { EChartsOption } from 'echarts';
import type { InstructionDto, BioSampleDto } from '@/core/types';
import { parsePhases, toSeries } from './transforms';

export const PHASE_COLORS: Record<string, string> = {
  inhale: '#5BAD6F',
  hold: '#4B9CD3',
  exhale: '#E89B2A',
  rest: '#9E9E9E',
};

export const PHASE_LABELS: Record<string, string> = {
  inhale: 'Inhale',
  hold: 'Hold',
  exhale: 'Exhale',
  rest: 'Rest',
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

/**
 * Builds a line series entry. The stable `id` is informational only — the biometric
 * chart re-renders with `notMerge: true` (full rebuild) on each chunk, so components
 * are recreated fresh every render and never reconciled across merges.
 */
function buildLineSeriesEntry(
  id: string,
  gridIndex: number,
  data: [number, number][],
  name: string,
  color: string,
) {
  return {
    id,
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
 * detail panel. Up to five vertically-stacked grids are included — instruction phases only
 * when phase data is non-empty, heart rate, EEG bands, emotions, and motion sensors only when
 * their sample data is non-empty. Grid presence is derived from the same toSeries/parsePhases
 * calls that feed the option, so `height` is always consistent with the rendered layout.
 * All X-axes are value-based and linked via dataZoom.
 *
 * Grids, axes, and series carry stable role-based `id`s, but the biometric chart renders
 * with `notMerge: true` (full rebuild per chunk), so indices are reassigned fresh on every
 * render. This is what keeps the layout correct when a sampleType first appears in a later
 * chunk (e.g. a BCI sensor that locks after warmup): incremental merge (`notMerge: false`
 * and `replaceMerge` alike) preserves each component's creation-order index and would bind
 * series to the wrong axes; a full rebuild avoids that entirely.
 *
 * The optional `zoom` parameter preserves the current zoom window across each full rebuild.
 * Without it, each rebuild would re-apply `start: 0, end: 100` and snap the view to full.
 *
 * Returns `gridCount` — the number of grids that will be rendered — so callers can detect
 * when nothing is renderable (gridCount === 0) and show an empty state instead of the chart.
 */
export function buildSessionChartOption(
  instructions: InstructionDto[],
  biometrics: BioSampleDto[],
  startedAt: string,
  endedAt: string,
  zoom: { start: number; end: number } = { start: 0, end: 100 },
): { option: EChartsOption; height: number; gridCount: number } {
  const startMs = new Date(startedAt).getTime();
  const durationSec = (new Date(endedAt).getTime() - startMs) / 1000;

  // --- Data transforms ---
  const phases = parsePhases(instructions, startedAt, endedAt);

  // Partition biometrics by sampleType in a single pass.
  const byType = new Map<string, BioSampleDto[]>();
  for (const s of biometrics) {
    let bucket = byType.get(s.sampleType);
    if (!bucket) {
      bucket = [];
      byType.set(s.sampleType, bucket);
    }
    bucket.push(s);
  }

  const cardio = byType.get('cardio') ?? [];
  const nfb = byType.get('nfb') ?? [];
  const emotions = byType.get('emotions') ?? [];

  const heartRateSeries = toSeries(cardio, 'heartRate', startMs);

  const deltaSeries = toSeries(nfb, 'delta', startMs);
  const thetaSeries = toSeries(nfb, 'theta', startMs);
  const alphaSeries = toSeries(nfb, 'alpha', startMs);
  const smrSeries = toSeries(nfb, 'smr', startMs);
  const betaSeries = toSeries(nfb, 'beta', startMs);

  const attentionSeries = toSeries(emotions, 'attention', startMs);
  const relaxationSeries = toSeries(emotions, 'relaxation', startMs);
  const cogLoadSeries = toSeries(emotions, 'cognitiveLoad', startMs);
  const cogCtrlSeries = toSeries(emotions, 'cognitiveControl', startMs);
  const selfCtrlSeries = toSeries(emotions, 'selfControl', startMs);

  const motion = byType.get('motion') ?? [];
  const axSeries = toSeries(motion, 'ax', startMs);
  const aySeries = toSeries(motion, 'ay', startMs);
  const azSeries = toSeries(motion, 'az', startMs);
  const gxSeries = toSeries(motion, 'gx', startMs);
  const gySeries = toSeries(motion, 'gy', startMs);
  const gzSeries = toSeries(motion, 'gz', startMs);

  // --- Presence flags ---
  const hasPhases = phases.length > 0;
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
  const hasMotion =
    axSeries.length > 0 ||
    aySeries.length > 0 ||
    azSeries.length > 0 ||
    gxSeries.length > 0 ||
    gySeries.length > 0 ||
    gzSeries.length > 0;

  // --- Dynamic grid index assignment ---
  // INSTRUCTION_GRID is index 0 when phase data is present, otherwise omitted.
  // Each optional grid occupies the next available index.
  let nextIdx = 0;
  const INSTRUCTION_GRID = hasPhases ? nextIdx++ : undefined;
  const HR_GRID = hasHeartRate ? nextIdx++ : undefined;
  const EEG_GRID = hasEeg ? nextIdx++ : undefined;
  const EMOT_GRID = hasEmotions ? nextIdx++ : undefined;
  const MOTION_GRID = hasMotion ? nextIdx++ : undefined;
  const totalGrids = nextIdx;

  // Grid definitions ordered by presence — parallel to the index assignment above.
  // Each entry carries a stable role-based id so ECharts merge reconciles by id, not
  // array index. This prevents misalignment when a sampleType first appears in a later chunk.
  interface GridDef { id: string; height: number }
  const gridDefs: GridDef[] = [
    ...(hasPhases ? [{ id: 'instruction', height: INSTRUCTION_HEIGHT }] : []),
    ...(hasHeartRate ? [{ id: 'hr', height: DATA_HEIGHT }] : []),
    ...(hasEeg ? [{ id: 'eeg', height: DATA_HEIGHT }] : []),
    ...(hasEmotions ? [{ id: 'emot', height: DATA_HEIGHT }] : []),
    ...(hasMotion ? [{ id: 'motion', height: DATA_HEIGHT }] : []),
  ];

  // --- Grid top-position computation ---
  const gridTops: number[] = [];
  let currentTop = TOP;
  for (const { height: h } of gridDefs) {
    gridTops.push(currentTop);
    currentTop += h + GAP;
  }

  // --- Grids ---
  const grids = gridDefs.map(({ id, height }, i) => ({
    id,
    left: LEFT,
    right: RIGHT,
    top: gridTops[i],
    height,
  }));

  // --- X-axes (one per grid, value type, same domain) ---
  const xAxes = gridDefs.map(({ id }, i) => ({
    id: `${id}-x`,
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
    // Instruction grid — hidden, 0-1 scale for renderItem anchoring (only when phases exist)
    ...(INSTRUCTION_GRID !== undefined
      ? [
          {
            id: 'instruction-y',
            type: 'value' as const,
            gridIndex: INSTRUCTION_GRID,
            min: 0,
            max: 1,
            show: false,
          },
        ]
      : []),
    ...(HR_GRID !== undefined
      ? [
          {
            id: 'hr-y',
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
            id: 'eeg-y',
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
            id: 'emot-y',
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
    ...(MOTION_GRID !== undefined
      ? [
          {
            id: 'motion-y',
            type: 'value' as const,
            gridIndex: MOTION_GRID,
            scale: true,
            name: 'm/s²·rad/s',
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
  // Only emitted when phase data is present (INSTRUCTION_GRID is defined).
  const phaseSeries =
    INSTRUCTION_GRID !== undefined
      ? {
          id: 'phase',
          type: 'custom' as const,
          xAxisIndex: INSTRUCTION_GRID,
          yAxisIndex: INSTRUCTION_GRID,
          renderItem: (params: { dataIndex: number }, api: RenderItemAPI) => {
            const startSec = api.value(0);
            const endSec = api.value(1);
            // coord maps [dataSec, dataY] → [pixelX, pixelY].
            // Y=1 is the top of the instruction grid, Y=0 is the bottom.
            const topLeft = api.coord([startSec, 1]);
            const bottomRight = api.coord([endSec, 0]);
            const barWidth = Math.max(bottomRight[0] - topLeft[0], 1);
            const barHeight = Math.max(bottomRight[1] - topLeft[1], 1);
            const rect = {
              type: 'rect' as const,
              shape: {
                x: topLeft[0],
                y: topLeft[1],
                width: barWidth,
                height: barHeight,
              },
              style: api.style(),
              z2: 0,
            };
            if (barWidth < 40) return rect;
            const bar = phases[params.dataIndex];
            const phaseLabel = PHASE_LABELS[bar.phase] ?? bar.phase;
            const label =
              bar.durationMs !== undefined
                ? `${phaseLabel} · ${Math.round(bar.durationMs / 1000)}s`
                : phaseLabel;
            const text = {
              type: 'text' as const,
              style: {
                text: label,
                x: topLeft[0] + 6,
                y: topLeft[1] + barHeight / 2,
                fill: '#fff',
                font: 'bold 11px sans-serif',
                textBaseline: 'middle',
              },
              z2: 1,
            };
            return { type: 'group', children: [rect, text] };
          },
          data: phases.map((p) => ({
            value: [p.startSec, p.endSec],
            itemStyle: { color: PHASE_COLORS[p.phase] ?? '#ccc' },
          })),
          z: 2,
          // Suppress phase bars from the axis tooltip — start/end seconds are meaningless there.
          tooltip: { show: false },
        }
      : null;

  const allSeries = [
    ...(phaseSeries != null ? [phaseSeries] : []),
    ...(HR_GRID !== undefined
      ? [buildLineSeriesEntry('hr', HR_GRID, heartRateSeries, 'Heart Rate', '#f88d8d')]
      : []),
    ...(EEG_GRID !== undefined
      ? [
          buildLineSeriesEntry('eeg-delta', EEG_GRID, deltaSeries, 'delta', '#4B9CD3'),
          buildLineSeriesEntry('eeg-theta', EEG_GRID, thetaSeries, 'theta', '#5BAD6F'),
          buildLineSeriesEntry('eeg-alpha', EEG_GRID, alphaSeries, 'alpha', '#E89B2A'),
          buildLineSeriesEntry('eeg-smr', EEG_GRID, smrSeries, 'smr', '#C973C1'),
          buildLineSeriesEntry('eeg-beta', EEG_GRID, betaSeries, 'beta', '#E96F6F'),
        ]
      : []),
    ...(EMOT_GRID !== undefined
      ? [
          buildLineSeriesEntry('emot-attention', EMOT_GRID, attentionSeries, 'attention', '#4B9CD3'),
          buildLineSeriesEntry('emot-relaxation', EMOT_GRID, relaxationSeries, 'relaxation', '#5BAD6F'),
          buildLineSeriesEntry('emot-cogLoad', EMOT_GRID, cogLoadSeries, 'cognitiveLoad', '#E89B2A'),
          buildLineSeriesEntry('emot-cogCtrl', EMOT_GRID, cogCtrlSeries, 'cognitiveControl', '#C973C1'),
          buildLineSeriesEntry('emot-selfCtrl', EMOT_GRID, selfCtrlSeries, 'selfControl', '#E96F6F'),
        ]
      : []),
    ...(MOTION_GRID !== undefined
      ? [
          buildLineSeriesEntry('motion-ax', MOTION_GRID, axSeries, 'ax', '#60B4E8'),
          buildLineSeriesEntry('motion-ay', MOTION_GRID, aySeries, 'ay', '#82C492'),
          buildLineSeriesEntry('motion-az', MOTION_GRID, azSeries, 'az', '#F0B060'),
          buildLineSeriesEntry('motion-gx', MOTION_GRID, gxSeries, 'gx', '#D4739A'),
          buildLineSeriesEntry('motion-gy', MOTION_GRID, gySeries, 'gy', '#7BC7C7'),
          buildLineSeriesEntry('motion-gz', MOTION_GRID, gzSeries, 'gz', '#B8A4D8'),
        ]
      : []),
  ];

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
        xAxisIndex: 'all' as const,
        start: zoom.start,
        end: zoom.end,
      },
      {
        type: 'slider' as const,
        xAxisIndex: 'all' as const,
        bottom: 10,
        height: 30,
        start: zoom.start,
        end: zoom.end,
      },
    ],
  };

  return { option, height, gridCount: totalGrids };
}
