# Motion Sensor Grid in Session Chart

**Date:** 2026-06-03
**Source:** conversation context

## Key Findings

- `sampleType: 'motion'` is sent by the mobile app but currently ignored by `chartOption.ts` — the partition loop already populates `byType` but nothing consumes it.
- Motion payload fields: `ax`, `ay`, `az` (accelerometer m/s²) and `gx`, `gy`, `gz` (gyroscope rad/s), plus `source` (string, not charted).
- Add one new ECharts grid (MOTION_GRID) below the emotions grid, with 6 line series and a shared Y-axis labeled `m·s⁻²/rad·s⁻¹` (or two grids accel/gyro — one grid is simpler and sufficient for MVP).

## Details

### File to change

`src/pages/SessionsPage/chartOption.ts`

### Data extraction

```typescript
const motion = byType.get('motion') ?? [];
const axSeries  = toSeries(motion, 'ax',  startMs);
const aySeries  = toSeries(motion, 'ay',  startMs);
const azSeries  = toSeries(motion, 'az',  startMs);
const gxSeries  = toSeries(motion, 'gx',  startMs);
const gySeries  = toSeries(motion, 'gy',  startMs);
const gzSeries  = toSeries(motion, 'gz',  startMs);

const hasMotion =
  axSeries.length > 0 || aySeries.length > 0 || azSeries.length > 0 ||
  gxSeries.length > 0 || gySeries.length > 0 || gzSeries.length > 0;
```

### Grid index threading

Follow the same pattern as HR_GRID / EEG_GRID / EMOT_GRID:
```typescript
const MOTION_GRID = hasMotion ? nextIdx++ : undefined;
```
Add to `gridHeights`, `gridTops`, `grids`, `xAxes`, `yAxes`, and `allSeries` in the same conditional style as the existing grids.

### Y-axis

Single Y-axis for MOTION_GRID, `scale: true`, name `'m/s²·rad/s'`, same style as BPM/μV/Score axes.

### Series colors

| Series | Color    |
|--------|----------|
| ax     | `#60B4E8` |
| ay     | `#82C492` |
| az     | `#F0B060` |
| gx     | `#D4739A` |
| gy     | `#7BC7C7` |
| gz     | `#B8A4D8` |

### gridCount

`totalGrids` already counts `nextIdx` — adding MOTION_GRID increments it automatically; `isEmpty` logic unchanged.

### Verify

Open a session that has motion samples (any breath session with a connected device). The chart grows by one grid at the bottom with 6 overlapping lines for accelerometer and gyroscope.
