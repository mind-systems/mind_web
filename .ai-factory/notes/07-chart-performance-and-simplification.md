# Chart Performance & Transform Simplification

**Date:** 2026-05-30
**Source:** Code review — efficiency scan + simplification scan

## Key Findings

- `toSeries` is called 11 times; each call filters the full biometrics array and re-parses `new Date(startedAt)` per sample — O(n × 11) instead of O(n)
- `buildSessionChartOption` has no `useMemo` in `SessionCharts` — rebuilds the entire ECharts option on every parent re-render
- `orderMap` + `.sort()` in `groupByDevice` duplicate what `Map` already guarantees (insertion order)
- `allXAxisIndices` array can be replaced with ECharts' built-in `'all'` string

## Fix 1 — Pre-partition biometrics and hoist startMs

**`src/pages/SessionsPage/transforms.ts`** — change `toSeries` signature:

```typescript
// Before: startedAt string, re-parses per sample
export function toSeries(
  samples: BioSampleDto[],
  sampleType: string,
  field: string,
  startedAt: string,
): [number, number][]

// After: receives pre-filtered slice and pre-parsed startMs
export function toSeries(
  samples: BioSampleDto[],   // already the right sampleType — no filter needed here
  field: string,
  startMs: number,           // new Date(startedAt).getTime() — parsed once by caller
): [number, number][] {
  return samples
    .filter(s => typeof s.data[field] === 'number')
    .map(s => [(new Date(s.timestamp).getTime() - startMs) / 1000, s.data[field] as number]);
}
```

**`src/pages/SessionsPage/chartOption.ts`** — add pre-partition before the `toSeries` calls:

```typescript
const startMs = new Date(startedAt).getTime();

// Pre-partition once: O(n) single pass
const byType = new Map<string, BioSampleDto[]>();
for (const s of biometrics) {
  const bucket = byType.get(s.sampleType);
  if (bucket) bucket.push(s);
  else byType.set(s.sampleType, [s]);
}
const cardioSamples   = byType.get('cardio')   ?? [];
const nfbSamples      = byType.get('nfb')      ?? [];
const emotionSamples  = byType.get('emotions') ?? [];

// Each toSeries call now works on a small pre-filtered slice
const heartRateSeries = toSeries(cardioSamples,  'heartRate',        startMs);
const deltaSeries     = toSeries(nfbSamples,     'delta',            startMs);
const thetaSeries     = toSeries(nfbSamples,     'theta',            startMs);
const alphaSeries     = toSeries(nfbSamples,     'alpha',            startMs);
const smrSeries       = toSeries(nfbSamples,     'smr',              startMs);
const betaSeries      = toSeries(nfbSamples,     'beta',             startMs);
const attentionSeries = toSeries(emotionSamples, 'attention',        startMs);
const relaxationSeries= toSeries(emotionSamples, 'relaxation',       startMs);
const cogLoadSeries   = toSeries(emotionSamples, 'cognitiveLoad',    startMs);
const cogCtrlSeries   = toSeries(emotionSamples, 'cognitiveControl', startMs);
const selfCtrlSeries  = toSeries(emotionSamples, 'selfControl',      startMs);
```

Also update `durationSec` to use the already-parsed `startMs`:

```typescript
// Before
const durationSec = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;

// After
const durationSec = (new Date(endedAt).getTime() - startMs) / 1000;
```

The `secFromStart` export in `transforms.ts` can remain as-is (used in `parsePhases` which is called once, not 11 times).

## Fix 2 — useMemo in SessionCharts

**`src/pages/SessionsPage/SessionCharts.tsx`** line 26:

```typescript
// Before
const { option, height } = buildSessionChartOption(
  instructions, biometrics, session.startedAt, session.endedAt,
);

// After
const { option, height } = useMemo(
  () => buildSessionChartOption(instructions, biometrics, session.startedAt, session.endedAt),
  [instructions, biometrics, session.startedAt, session.endedAt],
);
```

Add `useMemo` to the import from `'react'`.

## Fix 3 — Remove orderMap and dead sort from groupByDevice

**`src/pages/CalibrationPage/transforms.ts`** — `Map` already iterates in insertion order; `orderMap` + `.sort()` are a no-op:

```typescript
export function groupByDevice(records: NfbCalibrationRecord[]): DeviceGroup[] {
  const groupMap = new Map<string, NfbCalibrationRecord[]>();

  for (const record of records) {
    const bucket = groupMap.get(record.deviceSerial);
    if (bucket) bucket.push(record);
    else groupMap.set(record.deviceSerial, [record]);
  }

  return Array.from(groupMap.entries()).map(([deviceSerial, recs]) => {
    const sorted = [...recs].sort(
      (a, b) => new Date(a.calibratedAt).getTime() - new Date(b.calibratedAt).getTime(),
    );
    return {
      deviceSerial,
      records: sorted,
      validCount: sorted.filter(r => r.isValid).length,
    };
  });
}
```

Delete `orderMap` and the `.sort(([a], [b]) => ...)` call. The intra-device chronological sort (by `calibratedAt`) is still needed and stays.

## Fix 4 — Replace allXAxisIndices with 'all'

**`src/pages/SessionsPage/chartOption.ts`** — ECharts accepts the string `'all'` for `xAxisIndex` in `dataZoom`, which links all x-axes without listing them:

```typescript
// Delete this line entirely:
const allXAxisIndices = Array.from({ length: totalGrids }, (_, i) => i);

// In dataZoom — replace xAxisIndex: allXAxisIndices with xAxisIndex: 'all' in both entries:
dataZoom: [
  { type: 'inside', xAxisIndex: 'all', start: 0, end: 100 },
  { type: 'slider', xAxisIndex: 'all', bottom: 10, height: 30, start: 0, end: 100 },
],
```
