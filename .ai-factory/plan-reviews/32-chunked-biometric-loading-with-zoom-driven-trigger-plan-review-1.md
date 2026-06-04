# Plan Review: Chunked biometric loading with zoom-driven trigger

**Plan:** `32-chunked-biometric-loading-with-zoom-driven-trigger.md`
**Scope:** `mind_web` — replace the single full-session biometrics fetch (413) with 30 s chunked loading triggered by ECharts `datazoom`.
**Risk Level:** 🟢 Low

> Note: the targeted files are already staged/modified in the working tree (the plan appears to have been implemented). This review evaluates the **plan** for correctness, completeness, and architectural fit, cross-checking the actual code as the source of truth.

---

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`)** — `PASS`.
  - All HTTP goes through `core/api/client.ts` (`apiFetch`) — both the new hook and `SessionCharts` comply with the "single fetch point" principle. No raw `fetch`.
  - `useBiometricChunks` and `SessionCharts` live under `pages/SessionsPage/` — page-local feature data ownership is explicitly allowed ("Page-local feature sub-components under `pages/<Feature>/` may co-locate their own `useQuery`/data concerns"). `EChart` stays a presentation-only shared component (receives `option`/`onEvents` as props, no fetch). Boundaries respected.
  - No `localStorage` access introduced. Clean.
- **Rules (`.ai-factory/rules/base.md` present; no `RULES.md`)** — `PASS`. No `mind_auth_token` rename, no proto edits, no raw storage. English-only respected.
- **Roadmap (`.ai-factory/ROADMAP.md`)** — `PASS`. Plan maps 1:1 to the Phase 12 milestone "Chunked biometric loading with zoom-driven trigger" (correct hook name, `CHUNK_SEC = 30`, ref-based dedup, half-open windows, per-fetch ignore guard, `notMerge: true` rationale, soft chunk errors, per-session `key`, "don't show No data until all chunks attempted"). Strong linkage.

---

## Critical Issues

None. File paths, API shapes, and ECharts usage are all correct:
- `BioSampleDto.timestamp` is `string` (ISO) — the hook's `new Date(fromMs).toISOString()` request encoding and `toSeries`' `new Date(s.timestamp).getTime()` are consistent with the type.
- Endpoint `/sessions/runs/${id}/biometrics?from=&to=` matches the existing instructions-query pattern and the prior full-range fetch — no API/migration change required (this is a frontend-only repo anyway).
- The concurrency model (single in-flight via `inFlightRef` + `isLoading` gate, queue drain, `fetchIdRef` stale-response guard, refs-only dedup keeping `requestChunks` stable) is internally consistent and free of obvious retry-storm or race paths. The reset effect's cleanup bumping `fetchIdRef` correctly invalidates in-flight fetches on session switch/unmount.

---

## Non-Blocking Observations (WARN)

1. **Default full-range view loads only chunk 0 — rest of the timeline is blank until the user interacts.** `WARN`
   On mount, the reset effect enqueues only chunk 0, and the chart renders at `start:0/end:100` over a `[0, durationSec]` x-axis. ECharts does **not** emit a `datazoom` event on initial `setOption`, so for a long session (e.g. 600 s) the user initially sees only the first 30 s plotted against a full-width axis — the remaining ~95% of the chart is empty with no visual cue that panning/zooming loads more. There is no progressive/background drain to fill subsequent chunks.
   This is consistent with the 413-avoidance intent and the plan's stated "accepted trade-off," but the plan does not call out the resulting first-paint UX. If "load only what's in view" is the deliberate product decision, no change is needed — just confirm it. If the intent was closer to the roadmap's "loads 30 s chunks sequentially," consider an auto-advance that keeps draining the next chunk in the background until the session is fully loaded (or until the visible window is covered). Worth an explicit decision rather than an emergent behavior.

2. **`from`/`to` inclusivity is an unstated assumption.** `WARN`
   The half-open windowing (`fromMs = …+1` for `idx>0`, `toMs` inclusive of the boundary ms) relies on the API treating both `from` and `to` as **inclusive** bounds. If the server treats `to` as exclusive, a sample landing exactly on a chunk boundary could be dropped. Low risk (ms-resolution timestamps, and the prior full-range fetch used the same inclusive `from=startedAt&to=endedAt` convention), but the plan should note the assumption so it can be verified against `mind_api` if a boundary sample ever goes missing.

3. **`// eslint-disable-next-line react-hooks/refs` is likely a no-op directive.** `WARN`
   `react-hooks/refs` is not a rule in the stable `eslint-plugin-react-hooks` (the dependency rule is `exhaustive-deps`, which does not flag reading `zoomRef.current` inside `useMemo` anyway). The directive is harmless but unnecessary; if the lint config enables `reportUnusedDisableDirectives`, it could surface as an unused-directive warning. Recommend running `npm run lint` after implementation and dropping the comment if it isn't needed. (The underlying technique — reading the ref at rebuild time without subscribing the memo — is sound.)

---

## Positive Notes

- Excellent rationale capture: the `notMerge: true` decision (creation-order axis index cross-wiring under merge/`replaceMerge`) is documented both in the plan and inline in `SessionCharts.tsx`/`chartOption.ts`, so future maintainers won't "optimize" it back to incremental merge.
- The `onEvents` binding is correctly isolated into a separate effect keyed on `[onEvents, isDark]` with off-before-on, never inside the `init`/`dispose` effect — this avoids tearing down the canvas on handler changes and re-binds after a theme-driven canvas recreate. Correct and subtle.
- Stable identities are handled carefully throughout: `requestChunks` keyed on `totalChunks`, `handleDataZoom` deps excluding per-chunk state, `events` memoized — together they prevent the EChart binding effect from re-running on every chunk arrival.
- Per-session `key={selectedSession.id}` on `<SessionCharts>` plus the `session.id` reset effect give two independent guarantees that accumulated state/zoom/chart reset on switch.
- Empty-state gated on `gridCount === 0` (not raw array lengths) correctly preserves the existing meditation/no-BCI handling and lets later chunks still populate.
- Clean phasing and commit plan; dependencies between tasks are explicit and correct.

---

PLAN_REVIEW_PASS
