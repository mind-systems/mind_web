# Incremental chart update on stable grid structure (no full rebuild per chunk)

**Date:** 2026-06-21
**Source:** conversation context (perf triage; API-owner flag on appendData)

## Key Findings

- The chart renders with `notMerge` true (full rebuild) on **every** chunk (`SessionCharts.tsx:164`) — the single biggest per-chunk cost. The full rebuild exists for correctness: incremental merge cross-wires series→axis when a **new** `sampleType` first appears in a later chunk (`chartOption.ts:63-76` comment). ECharts preserves component creation-order indices across merge and `replaceMerge`, so the option's numeric `xAxisIndex`/`yAxisIndex` resolve to the wrong axes.
- That hazard only occurs on a **structural change** (a new grid appears). When the set of present grids is unchanged, every series carries a stable role-based `id` and a merge updates only its `data` safely.

## Details

### Change
- `buildSessionChartOption` (`chartOption.ts:84-438`) returns a **structure signature** alongside `gridCount` — the ordered present-grid ids, e.g. `"instruction,hr,eeg,emot,motion"` (derivable from the existing `gridDefs`).
- In `SessionCharts.tsx`, track the previous signature in a ref. Pass `notMerge` to `<EChart>` only when the signature **changed** (first render, or a grid appeared) → full rebuild; otherwise pass `notMerge: false` so ECharts merges by `id` and swaps each series' `data`.
- Update by replacing each series' **full (sorted, note 29) `data` array** — **NOT** `appendData` (API-owner flag #2: `appendData` can neither handle out-of-order chunks nor add a new grid).

### Guard
- MUST full-rebuild on first render and on any signature change. Grids only ever appear within a session — treat any signature delta as a full rebuild (defensive).
- Keep zoom preservation (`zoomRef`) working on both paths; `yAxis.scale: true` auto-range still recomputes under merge.
- The `EChart` wrapper already keys its `setOption` effect on `[option, notMerge, isDark]` (`EChart/index.tsx:47-53`), so passing a dynamic `notMerge` boolean works with no wrapper change.
- **Lint:** the render-phase read `const notMerge = prevSignatureRef.current !== structureSignature` must carry `// eslint-disable-next-line react-hooks/refs`, mirroring the existing `zoomRef.current` read at `SessionCharts.tsx:104`. The project's `eslint-plugin-react-hooks@7` flags render-phase `ref.current` access, so `npm run lint` fails without it. Write the ref only inside `useEffect` (allowed — no disable needed). This was the single recurring gap that failed three plan-review rounds.

### Risk / ordering
- Highest-risk of the client tasks — it touches the axis-binding invariant the full rebuild was introduced to protect. Ship **after** notes 28 and 31; if `minmax` sampling + `large`/`progressive` already make full rebuilds cheap enough, this can be deferred.

### Verify
- Warm-up session where `nfb` locks ~60 s in: when the EEG grid first appears a full rebuild fires (no axis cross-wiring); subsequent chunks merge without rebuild — measure the `setOption` time drop.

## Open Questions

- None — but treat as deferrable pending the measured effect of notes 28 + 31.
