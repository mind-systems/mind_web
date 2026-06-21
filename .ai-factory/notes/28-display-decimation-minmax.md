# Display decimation for long-session charts — minmax vs lttb

**Date:** 2026-06-21
**Source:** conversation context (perf triage of 30-min sessions; API-owner review)

## Key Findings

- The freeze on long (30 min+) meditation sessions is **rasterization/CPU**, not RAM. A 30-min EEG signal at ~250 Hz is ~450k points per series mapped onto a ~1500 px wide grid — ~300 points per physical pixel. Decimating the **drawn** points (not the stored data) removes the freeze with zero perceptible loss.
- ECharts `series.sampling` decimates per the current zoom span and rendered width and re-runs as the zoom changes, so zoom-in restores full per-sample detail from the still-complete `data` array.
- **Algorithm choice matters** (flagged by the API owner): `lttb` preserves overall *shape* but can drop a single-sample spike; `minmax` keeps each bucket's min and max so spikes survive. For EEG/HR a spike is signal → **default `minmax`** (ECharts ≥5.5; repo is on echarts 6.1.0). Use `lttb` only if smooth shape is wanted over peak fidelity.

## Details

### Change
- `src/pages/SessionsPage/chartOption.ts` — in `buildLineSeriesEntry` (lines 42-61) add `sampling: 'minmax'` to the returned line config.
- Applies only to `type: 'line'` entries. Do **not** add it to the phase custom series (`chartOption.ts:302-360`) — those are `[startSec, endSec]` range bars, not a sampled line, and already clip to the grid.

### Boundary (what this does NOT fix)
- Sampling reduces only what is **drawn**. The accumulated `biometrics` array and the per-field `toSeries` outputs still hold every raw sample, so the raw **memory/network footprint of a long session is unchanged**. Shrinking that is the job of the server-side LOD milestone (option 4 / mind_api), not this task. State this so nobody expects this flag to reduce memory.

### Verify
- 30-min session at full (0–100 %) zoom: no freeze; a known HR/EEG spike is still visible (compare against the raw series).
- Zoom into a 30 s window: full per-sample detail returns.

## Open Questions

- Confirm the product requirement: peak preservation (`minmax`) vs smooth shape (`lttb`). Default `minmax` unless product/clinical side says otherwise.
