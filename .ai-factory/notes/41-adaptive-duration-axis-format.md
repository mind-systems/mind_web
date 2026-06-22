# Adaptive duration format on the biometric X-axis

**Date:** 2026-06-22
**Source:** conversation context

## Key Findings

- The session chart X-axis is `type: 'value'` carrying **seconds elapsed from session start** (`chartOption.ts:207-220`), not an ECharts `type: 'time'` axis. ECharts therefore does **no** automatic time-scale adaptation — the label formatter is hard-wired to `(v) => \`${Math.round(v)}s\`` (`chartOption.ts:215`), so a 30 s window and a 2030 s window render identically-styled raw seconds (`30s`, `2030s`) that are unreadable and indistinguishable at a glance.
- Variant B (chosen over migrating to `type: 'time'`): **keep `type: 'value'`** (preserve "time from session start" semantics, leave the whole windowed-loading pyramid untouched) and replace the formatter with an adaptive clock-style **duration** formatter. This task is the formatter alone; zoom-driven tick density is the follow-up (note 42).
- The same raw-seconds problem appears on the **axis-pointer crosshair label** (`tooltip.axisPointer: { type: 'cross' }`, `chartOption.ts:415`): the cross label on the X-axis shows the raw value too. Format it with the same helper so the hover readout matches the ticks.
- Do **not** touch the in-bar phase duration suffix (`· Ns`, `chartOption.ts:341`) — that is a per-phase *length*, a different concern, and `Ns` reads correctly there.

## Details

### The change

Add a dedicated axis formatter helper — `formatAxisDuration(sec: number): string` — and use it in two places in `buildSessionChartOption` (`src/pages/SessionsPage/chartOption.ts`):

1. X-axis `axisLabel.formatter` (line 215) — replace `\`${Math.round(v)}s\``.
2. X-axis `axisPointer.label.formatter` — add a `label: { formatter: ({ value }) => formatAxisDuration(value) }` to the X-axis `axisPointer`, or set it on the tooltip's `axisPointer` so the crosshair X readout matches.

### Helper semantics

`formatAxisDuration` formats seconds-from-start as a clock duration, choosing width by magnitude so 30 vs 2030 are unambiguous:

- `total < 3600` → `M:SS` (e.g. 30 → `0:30`, 2030 → `33:50`)
- `total >= 3600` → `H:MM:SS` (e.g. 7200 → `2:00:00`)
- round to whole seconds; minutes/seconds zero-padded, leading hours/minutes not padded.

Placement: `src/core/format.ts` already holds `formatDate` and `formatDuration` (the latter is `mm:ss` and **caps at minutes**, used by the session list — do NOT repurpose it; it must keep its list semantics). Add `formatAxisDuration` as a new sibling export (it rolls into hours, which `formatDuration` does not), or keep it local to `chartOption.ts` if it should not leak. Prefer `src/core/format.ts` for reuse and a single duration-format home.

### What exists today

- `chartOption.ts:207-220` — the `xAxes` array; formatter at 215; only the bottom axis shows labels (`show: i === totalGrids - 1`).
- `chartOption.ts:410-416` — `tooltip` with `trigger: 'axis'`, `axisPointer: { type: 'cross' }`. No X formatter today, so the crosshair shows the raw seconds value.
- `src/core/format.ts:21-26` — `formatDuration` (`mm:ss`, minutes may exceed 99, no hours rollover).

### Guards

- `type: 'value'` stays — this task is **not** a migration to `type: 'time'`.
- Touch only the X-axis label + the X crosshair label. Do NOT change the in-bar phase `· Ns` suffix (`chartOption.ts:341`), the Y-axis labels, the phase custom series, or any dataZoom config.
- No tick-count / `interval` changes here — that is note 42. This task only changes how an existing tick's value is *rendered*.

### How to verify

Open a long session (30 min+). Bottom-axis ticks read as `M:SS` / `H:MM:SS` (e.g. `5:00`, `1:02:30`) instead of `300s` / `3750s`. Hover: the X crosshair label matches the tick format. A short session still reads sanely (`0:05`, `0:30`). Zoom in/out: labels stay readable (density is still ECharts-default until note 42).

## Open Questions

- Whether to also reflect the duration format inside the per-series tooltip body (the X line) — currently out of scope; the axis-pointer label covers the hover readout. Revisit if the tooltip header still shows raw seconds after the cross label is formatted.
