# Phase Text Labels in Instruction Grid

**Date:** 2026-06-03
**Source:** conversation context

## Key Findings

- Currently the instruction grid renders solid colored bars (inhale/hold/exhale/rest) with no text — the user cannot read which phase is which without a legend.
- The instruction data includes `durationMs` (planned phase duration) alongside `phase` name — both are useful for display.
- ECharts custom series `renderItem` supports returning a `group` with `rect` + `text` children.
- Text should only render when the bar is wide enough (≥ 40 px); narrow bars (fast phases, zoomed out) get only the color.

## Details

### Data change: add phase name as third dimension

In `chartOption.ts`, extend the phase series data to carry the phase name as a label:

```typescript
// PhaseBar already has .phase — pass it through to the series data
data: phases.map((p) => ({
  value: [p.startSec, p.endSec],
  name: p.phase,                      // used in renderItem via params.name (or encode as dim 2)
  itemStyle: { color: PHASE_COLORS[p.phase] ?? '#ccc' },
  durationMs: p.durationMs,           // add to PhaseBar type + parsePhases
})),
```

Alternatively encode as dimension index 2 if `params.name` is not easily accessible from the typed `RenderItemAPI`. Either works; use whichever requires less type-unsafe casting.

### `renderItem` — return group with rect + text

```typescript
renderItem: (params: unknown, api: RenderItemAPI) => {
  const startSec = api.value(0);
  const endSec   = api.value(1);
  const topLeft     = api.coord([startSec, 1]);
  const bottomRight = api.coord([endSec,   0]);
  const barWidth  = Math.max(bottomRight[0] - topLeft[0], 1);
  const barHeight = Math.max(bottomRight[1] - topLeft[1], 1);

  const rect = {
    type: 'rect',
    shape: { x: topLeft[0], y: topLeft[1], width: barWidth, height: barHeight },
    style: api.style(),
    z2: 0,
  };

  if (barWidth < 40) return rect;   // too narrow for text

  const label = PHASE_LABELS[(params as any).name] ?? (params as any).name ?? '';
  const text = {
    type: 'text',
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
```

### `PHASE_LABELS` map

```typescript
export const PHASE_LABELS: Record<string, string> = {
  inhale: 'Inhale',
  hold:   'Hold',
  exhale: 'Exhale',
  rest:   'Rest',
};
```

### PhaseBar type + parsePhases: carry durationMs

Extend `PhaseBar` in `src/core/types/index.ts`:
```typescript
export interface PhaseBar {
  startSec: number;
  endSec: number;
  phase: BreathPhase;
  durationMs?: number;   // add
}
```

In `parsePhases`: `durationMs: event.data.durationMs`. (Depends on note 18 fix landing first.)

### Verify

After note-18 fix is in: open a breath session with instruction data, zoom in on the instruction grid — each phase bar shows its name in white text. Narrow bars (< 40 px) show only the color.
