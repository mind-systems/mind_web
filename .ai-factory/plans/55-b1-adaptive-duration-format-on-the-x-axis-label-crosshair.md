# Plan: (B1) Adaptive duration format on the X-axis label + crosshair

## Context
Replace the raw `${Math.round(v)}s` X-axis rendering on the biometric session chart with an adaptive clock-style duration formatter (`M:SS` / `H:MM:SS`) applied to both the bottom-axis tick labels and the crosshair X readout, so long-session ticks like `2030s` become readable `33:50`.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Formatter helper

- [x] **Task 1: Add `formatAxisDuration` helper**
  Files: `src/core/format.ts`
  Add a new sibling export beside `formatDate`/`formatDuration` (do NOT modify or repurpose `formatDuration`, which stays `mm:ss` for the session list). Signature: `formatAxisDuration(sec: number): string`. Round to whole seconds (`Math.round`). Below 3600s → `M:SS` (leading minutes not zero-padded, seconds zero-padded to 2): `30 → "0:30"`, `2030 → "33:50"`. At/above 3600s → `H:MM:SS` (leading hours not padded, minutes and seconds zero-padded to 2): `7200 → "2:00:00"`. Add a short JSDoc noting it rolls into hours (unlike `formatDuration`) and is intended for the value-type duration axis.

### Phase 2: Wire into chart option

- [x] **Task 2: Use the helper for the X-axis label and crosshair** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Import `formatAxisDuration` from `@/core/format`. In the `xAxes` map (~line 213-216) replace `formatter: (v: number) => \`${Math.round(v)}s\`` with `formatter: (v: number) => formatAxisDuration(v)`. For the crosshair, format the X axis-pointer label: add `axisPointer: { label: { formatter: ({ value }) => formatAxisDuration(value as number) } }` to each X axis object so the cross's X readout matches the tick format (the tooltip `axisPointer: { type: 'cross' }` at ~line 415 supplies the crosshair; the per-axis `label.formatter` controls its X text). Keep `type: 'value'`. Do NOT change the in-bar phase `· Ns` suffix (~line 341), Y-axis labels, `dataZoom`, tick count, or `interval`.
