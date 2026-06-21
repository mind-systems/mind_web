# M3 — High-res overlay + derived resolution switch

**Date:** 2026-06-21
**Source:** conversation context — Phase 20 decomposition (governing design: note 32)

## Key Findings

- This is the complex half (the resolution state machine), but the layered model keeps it clean: the immutable base from M2 is always the floor, so the overlay only ever *refines* the visible window — it never has to manage blanking, bridging, or empty-window dead-ends.
- Every slug-46 Medium finding (storm, blank-on-zoom-in, strand dead-end, skeleton-over-bridge) is prevented here **by construction**, not by a flag.

## Details

### Render = `detail ?? base`
`SessionCharts.tsx`: the displayed source is the window overlay when present, else the base. Because the base never empties, the chart NEVER blanks — no bridge, no skeleton-suppression, no unmount-on-empty-window. A higher-res overlay simply replaces the coarse base in the visible range once it resolves.

### Derived resolution (no stored mode)
Each `datazoom` (after persisting `zoomRef.current`): `spanSec = computeSpanSec(zoom, durationSec)`; `resolution = shouldUseRaw(spanSec, …)` (M1 hysteresis). No `useState mode`, no `useRawRef` — resolution is a pure function of the current window, recomputed per event. (If the stable-callback guarantee needs the latest span without re-creating `handleDataZoom`, read it from `zoomRef`, which is already the single source of the live window.)

### Two overlay providers
- **Mid-zoom → finer aggregate via React Query.** `bucketSec = computeBucketSec(spanSec)`; `[qFrom, qTo] = quantizeWindow(fromMs, toMs, bucketSec)` (M1); fetch keyed `['bio-agg', session.id, qFrom, qTo, bucketSec]`. The quantized key gives free dedup + cache: small pans within one quantized window are one request, zoom-back to a visited window is instant. No `lastAggSignatureRef`, no manual dedup, no storm.
- **Deep-zoom → lazy raw `useBiometricChunks`.** Keep the existing chunk loader (413 + chunk-index dedup stay). **Remove BOTH eager mount loads** so raw loads only past the threshold: the chunk-0 enqueue in the hook's session-reset effect AND the `SessionCharts` mount `requestWindowChunks` effect. `motion` ≈95 % of volume → Phase 19 `sampling:'minmax'` + `large`/`progressive` stays mandatory on this path.

### `notMerge` / structure
Keep note 30's structure-signature merge: a genuine present-grids delta between overlay and base (or during raw fill) correctly forces `notMerge:true`; matching grids stay `notMerge:false`. Derive it from the displayed (`detail ?? base`) option, as M2 already does.

### Accepted behavior
- Raw `biometrics` accumulated during a deep zoom-in is not reclaimed on zoom-out (cleared on `session.id` change). The headline win (default view never loads raw) holds. Optional: clear on the deep→coarse transition.

## Open Questions

- `detail` lifetime: keep the last overlay until the next resolves (smoother) vs clear on zoom-out and fall back to base (simpler) — prefer keeping it; base bridges either way.
