# ECharts Session Charts — Multi-Grid Implementation Spec

**Date:** 2026-05-30
**Source:** conversation context — roadmap review + mind_api/mind_mobile source inspection

## Key Findings

- Bio sample types from the API are `cardio`, `nfb`, `emotions` — not field-level names like "heart_rate" or "eeg"
- `cardio.data.heartRate`, `nfb.data.{delta,theta,alpha,smr,beta}`, `emotions.data.{attention,relaxation,cognitiveLoad,cognitiveControl,selfControl}`
- Instructions come as `{ timestamp, type, payload }` — filter to `type === "breath_phase"` to get phase bars; `payload.phase` is `"inhale"|"hold"|"exhale"|"rest"`
- Data fetch strategy for MVP: full session range on initial load; no incremental loading
- 4 grids are conditional — hide any grid whose sample type produced zero data points

## Data shapes

### Instructions endpoint

```
GET /sessions/runs/:id/instructions?from=<startedAt>&to=<endedAt>
→ [{ timestamp: string (ISO), type: string, payload: object }]
```

Filter to `type === "breath_phase"`. Each has `payload: { phase: "inhale"|"hold"|"exhale"|"rest", durationMs: number }`.

Phase bar start = this instruction's `timestamp`. Phase bar end = next instruction's `timestamp` (or `endedAt` for the last phase).

Ignore `type === "session_event"` — those mark lifecycle transitions (paused, resumed, etc.) and should not appear in the chart.

### Biometrics endpoint

```
GET /sessions/runs/:id/biometrics?from=<startedAt>&to=<endedAt>
→ [{ timestamp: string (ISO), sampleType: string, data: object }]
```

Split by `sampleType`:

| `sampleType` | Relevant `data` fields | Grid |
|---|---|---|
| `"cardio"` | `data.heartRate: number` (BPM) | Heart rate grid |
| `"nfb"` | `data.delta`, `data.theta`, `data.alpha`, `data.smr`, `data.beta` (all `number`) | EEG bands grid |
| `"emotions"` | `data.attention`, `data.relaxation`, `data.cognitiveLoad`, `data.cognitiveControl`, `data.selfControl` (all `number`) | Emotions grid |

Ignore `data.source` and `data.metricsAvailable` / `data.hasArtifacts` for charting purposes.

## Data transforms

### Timestamp → seconds from session start

All timestamps are ISO strings. Convert to X-axis value (seconds from session start):

```typescript
const secFromStart = (ts: string, startedAt: string) =>
  (new Date(ts).getTime() - new Date(startedAt).getTime()) / 1000;
```

### Instruction phases → bar data

```typescript
interface PhaseBar {
  startSec: number;
  endSec: number;
  phase: 'inhale' | 'hold' | 'exhale' | 'rest';
}

function parsePhases(
  instructions: InstructionDto[],
  startedAt: string,
  endedAt: string,
): PhaseBar[] {
  const breathPhases = instructions.filter(i => i.type === 'breath_phase');
  return breathPhases.map((instr, idx) => ({
    startSec: secFromStart(instr.timestamp, startedAt),
    endSec: idx < breathPhases.length - 1
      ? secFromStart(breathPhases[idx + 1].timestamp, startedAt)
      : secFromStart(endedAt, startedAt),
    phase: instr.payload.phase as PhaseBar['phase'],
  }));
}
```

### Biometrics → line series data

Each series is `[secFromStart, value]` pairs:

```typescript
const heartRate = samples
  .filter(s => s.sampleType === 'cardio')
  .map(s => [secFromStart(s.timestamp, startedAt), s.data.heartRate]);

const delta = samples
  .filter(s => s.sampleType === 'nfb')
  .map(s => [secFromStart(s.timestamp, startedAt), s.data.delta]);
// same for theta, alpha, smr, beta

const attention = samples
  .filter(s => s.sampleType === 'emotions')
  .map(s => [secFromStart(s.timestamp, startedAt), s.data.attention]);
// same for relaxation, cognitiveLoad, cognitiveControl, selfControl
```

## ECharts option skeleton

Build the option dynamically — only include grids for sample types that have data.

```typescript
const PHASE_COLORS: Record<string, string> = {
  inhale: '#a4f792',
  hold:   '#f8f08d',
  exhale: '#8dd6f8',
  rest:   '#8d8df8',
};

// Determine which optional grids are active
const hasHeartRate  = heartRate.length > 0;
const hasEeg        = delta.length > 0;   // nfb data
const hasEmotions   = attention.length > 0;

// Assign grid indices dynamically
let gridIdx = 0;
const INSTRUCTION_GRID = gridIdx++;
const HR_GRID    = hasHeartRate ? gridIdx++ : -1;
const EEG_GRID   = hasEeg      ? gridIdx++ : -1;
const EMOT_GRID  = hasEmotions ? gridIdx++ : -1;
const totalGrids = gridIdx;
const xAxisIndices = Array.from({ length: totalGrids }, (_, i) => i);

// Grid layout — each grid is 160px tall with 20px gap; instruction grid is 80px
const grids: echarts.GridComponentOption[] = [];
let top = 50; // leave room for panel header
grids.push({ top, height: 80, left: 60, right: 20 });
top += 80 + 20;
if (hasHeartRate)  { grids.push({ top, height: 160, left: 60, right: 20 }); top += 160 + 20; }
if (hasEeg)        { grids.push({ top, height: 160, left: 60, right: 20 }); top += 160 + 20; }
if (hasEmotions)   { grids.push({ top, height: 160, left: 60, right: 20 }); top += 160 + 20; }

const durationSec = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;

const option: echarts.EChartsOption = {
  grid: grids,

  xAxis: [
    { gridIndex: INSTRUCTION_GRID, type: 'value', min: 0, max: durationSec, show: false },
    ...(hasHeartRate ? [{ gridIndex: HR_GRID,   type: 'value', min: 0, max: durationSec, show: false }] : []),
    ...(hasEeg       ? [{ gridIndex: EEG_GRID,  type: 'value', min: 0, max: durationSec, show: false }] : []),
    ...(hasEmotions  ? [{ gridIndex: EMOT_GRID, type: 'value', min: 0, max: durationSec,
        axisLabel: { formatter: (v: number) => `${Math.round(v)}s` } }] : []),
  ],

  yAxis: [
    { gridIndex: INSTRUCTION_GRID, type: 'value', show: false },
    ...(hasHeartRate ? [{ gridIndex: HR_GRID,   type: 'value', name: 'BPM',   min: 40, max: 200, nameLocation: 'middle', nameGap: 40 }] : []),
    ...(hasEeg       ? [{ gridIndex: EEG_GRID,  type: 'value', name: 'Power', scale: true, nameLocation: 'middle', nameGap: 40 }] : []),
    ...(hasEmotions  ? [{ gridIndex: EMOT_GRID, type: 'value', scale: true }] : []),
  ],

  dataZoom: [
    { type: 'inside', xAxisIndex: xAxisIndices },
    { type: 'slider', xAxisIndex: xAxisIndices, bottom: 10 },
  ],

  axisPointer: {
    link: [{ xAxisIndex: 'all' }],
    type: 'cross',
  },

  series: [
    // Grid 0: instruction phase bars (custom renderItem)
    {
      type: 'custom',
      xAxisIndex: INSTRUCTION_GRID,
      yAxisIndex: 0,
      renderItem: (_params, api) => {
        const startCoord = api.coord([api.value(0), 0.5]);
        const endCoord   = api.coord([api.value(1), 0.5]);
        return {
          type: 'rect',
          shape: {
            x: startCoord[0],
            y: startCoord[1] - 15,
            width: Math.max(endCoord[0] - startCoord[0], 1),
            height: 30,
          },
          style: {
            fill: PHASE_COLORS[api.value(2) as string] ?? '#ccc',
          },
        };
      },
      data: phases.map(p => [p.startSec, p.endSec, p.phase]),
      z: 5,
    },

    // Grid 1: heart rate
    ...(hasHeartRate ? [{
      type: 'line' as const,
      xAxisIndex: HR_GRID,
      yAxisIndex: 1,
      color: '#f88d8d',
      data: heartRate,
      smooth: true,
      showSymbol: false,
      name: 'Heart rate',
    }] : []),

    // Grid 2: EEG bands (nfb)
    ...(hasEeg ? [
      { type: 'line' as const, xAxisIndex: EEG_GRID, yAxisIndex: HR_GRID !== -1 ? 2 : 1, color: '#8dd6f8', name: 'Delta',   data: delta,   showSymbol: false },
      { type: 'line' as const, xAxisIndex: EEG_GRID, yAxisIndex: HR_GRID !== -1 ? 2 : 1, color: '#b48df8', name: 'Theta',   data: theta,   showSymbol: false },
      { type: 'line' as const, xAxisIndex: EEG_GRID, yAxisIndex: HR_GRID !== -1 ? 2 : 1, color: '#f8f08d', name: 'Alpha',   data: alpha,   showSymbol: false },
      { type: 'line' as const, xAxisIndex: EEG_GRID, yAxisIndex: HR_GRID !== -1 ? 2 : 1, color: '#8df8e4', name: 'SMR',     data: smr,     showSymbol: false },
      { type: 'line' as const, xAxisIndex: EEG_GRID, yAxisIndex: HR_GRID !== -1 ? 2 : 1, color: '#f8b08d', name: 'Beta',    data: beta,    showSymbol: false },
    ] : []),

    // Grid 3: emotions
    ...(hasEmotions ? [
      { type: 'line' as const, xAxisIndex: EMOT_GRID, yAxisIndex: totalGrids - 1, color: '#c88df8', name: 'Attention',        data: attention,       showSymbol: false },
      { type: 'line' as const, xAxisIndex: EMOT_GRID, yAxisIndex: totalGrids - 1, color: '#a4f792', name: 'Relaxation',        data: relaxation,      showSymbol: false },
      { type: 'line' as const, xAxisIndex: EMOT_GRID, yAxisIndex: totalGrids - 1, color: '#a1bff6', name: 'Cognitive load',    data: cognitiveLoad,   showSymbol: false },
      { type: 'line' as const, xAxisIndex: EMOT_GRID, yAxisIndex: totalGrids - 1, color: '#f8c88d', name: 'Cognitive control', data: cognitiveControl, showSymbol: false },
      { type: 'line' as const, xAxisIndex: EMOT_GRID, yAxisIndex: totalGrids - 1, color: '#f88db8', name: 'Self-control',      data: selfControl,     showSymbol: false },
    ] : []),
  ],
};
```

**Note on yAxisIndex:** When grids are hidden, the yAxis array is shorter. Use the dynamic indices (HR_GRID, EEG_GRID, EMOT_GRID) directly as yAxisIndex values, same as xAxisIndex — they are the same index in both arrays since grid/xAxis/yAxis are kept in 1:1 correspondence.

## Fetch strategy (MVP)

Fetch both endpoints for the full session range on mount:

```typescript
const { data: instructions } = useQuery({
  queryKey: ['session-instructions', id],
  queryFn: () => apiFetch<InstructionDto[]>(
    `/sessions/runs/${id}/instructions?from=${session.startedAt}&to=${session.endedAt}`
  ),
});

const { data: biometrics } = useQuery({
  queryKey: ['session-biometrics', id],
  queryFn: () => apiFetch<BioSampleDto[]>(
    `/sessions/runs/${id}/biometrics?from=${session.startedAt}&to=${session.endedAt}`
  ),
});
```

No incremental dataZoom loading for MVP — fetching the full range is sufficient for sessions up to ~1 hour. The API supports time-range params for future lazy-loading optimization, but do not implement incremental fetching in this milestone.

## Y-axis scaling

Use `scale: true` on both the `nfb` and `emotions` yAxes — this auto-fits to the actual value range and avoids committing to a fixed scale before real data is available. The documented value ranges may not match what the device actually produces. Revisit axis labels and fixed min/max once the chart is running against a real session.
