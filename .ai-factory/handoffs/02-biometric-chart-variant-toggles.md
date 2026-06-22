# Handoff — biometric chart variant toggles (rendering/loading A/B testbed)

## 1. Frame
We were optimizing the long-session biometric chart in `mind_web` (ECharts, `SessionsPage`); after several optimization rounds the user PIVOTED — instead of committing to one downsample strategy, build a **toggle testbed above the chart** that switches between rendering/loading variants live, each backed by its own API endpoint, so they can compare side-by-side. The chat is compacted but the knowledge is durable in the files below — rehydrate from them, don't trust memory.

## 2. Read-first map

### Must-read now (minimal rehydration set)
- `.ai-factory/handoffs/02-biometric-chart-variant-toggles.md` — this file: the task + the 4 variants + the API endpoints needed.
- `.ai-factory/notes/32-server-lod-client-consumer.md` — the governing **base ⊕ overlay** architecture that is currently committed and live (the "current/min-max" variant).
- `../mind_api/.ai-factory/notes/58-biometric-lod-aggregated-read.md` — the API aggregation contract; today it emits a **min/max envelope** (the sawtooth source). The smoothed variant needs a new param here.

### Read on demand
- `.ai-factory/notes/33-bucket-policy.md`, `34-base-overview-layer.md`, `35-detail-overlay.md` — M1/M2/M3 specs (the committed base⊕overlay impl).
- `.ai-factory/notes/28-display-decimation-minmax.md` — client `sampling` decision (now changed to `lttb`, see §6).
- `.ai-factory/ROADMAP.md` — Phase 19 (client decimation, done) + Phase 20 (M1/M2/M3, done).
- `src/pages/SessionsPage/SessionCharts.tsx` — chart orchestrator (which hook feeds the chart).
- `src/pages/SessionsPage/useBiometricChunks.ts` — RAW 30 s chunk loader (Variant 1 restores its progressive behavior).
- `src/pages/SessionsPage/useBiometricOverview.ts` — M2 base layer (single full-session aggregate via React Query).
- `src/pages/SessionsPage/useBiometricAggregate.ts` — M3 overlay (window-scoped aggregate, RQ key `['bio-agg', sessionId, from, to, bucketSec]`, fetches `?bucketSec=`).
- `src/pages/SessionsPage/deriveView.ts` — unified `{kind:'loading'|'empty'|'error'|'ready'}` view-state.
- `src/pages/SessionsPage/bucketPolicy.ts` — pure zoom→`bucketSec` + `quantizeWindow` helpers.
- `src/pages/SessionsPage/chartOption.ts` — ECharts option builder (`buildLineSeriesEntry`, `sampling`/`large`/`progressive`).

## 3. Current state

**Done (committed):**
- Phase 19 client decimation (note 28): `sampling`/`large`/`progressive` on line series in `chartOption.ts`.
- Phase 20 base⊕overlay (M1/M2/M3) implemented and committed: `bucketPolicy.ts`, `useBiometricOverview.ts` (base, RQ), `useBiometricAggregate.ts` (overlay, RQ), `deriveView.ts`, wired into `SessionCharts.tsx`. This is the **current live behavior**.
- mind_api Phase 48 LIVE + verified: `GET /sessions/runs/:id/biometrics?bucketSec=<n>` → min/max envelope (2 synthetic `BioSampleDto`/bucket/sampleType).
- Decomposition + governing notes committed: 32 (architecture), 33/34/35 (M1/M2/M3), api note 58.

**In-flight (the pivot — this is the new work):**
- Build a **variant toggle testbed** (3 toggles now, 1 future). See §11.
- Fix a regression: progressive 30 s chunk loading is gone (chart now waits for the whole session) — Variant 1 restores it.
- API must expose endpoints for all variants **simultaneously** (raw / min-max / smoothed). The smoothed endpoint is NEW (mind_api work).

**Uncommitted working-tree state:**
- `src/pages/SessionsPage/chartOption.ts` — `sampling:'minmax'` → `'lttb'` (my edit). NOTE: this is a no-op for the aggregated path (see §6) but correct for the raw deep-zoom path. Decide whether to keep/commit; it does NOT fix the reported sawtooth.
- `git stash@{0}` — the superseded slug-46 band-aid LOD impl (kept for reference only; safe to drop).

## 4. Next step
Build the variant toggle testbed (web) and coordinate the API endpoints. Recommended order:
1. **Confirm the API endpoint surface** with the API owner (the user owns mind_api): raw `?from&to` (exists), min/max `?bucketSec` (exists), and a NEW smoothed `?bucketSec&agg=avg|lttb` returning ONE `BioSampleDto`/bucket/field. The user said API prep must provide these.
2. **Add 3 toggles above the chart** (Variant 1/2/3 in §11), each selecting a data-source hook + endpoint, all rendering through the existing `byType → toSeries(field) → buildLineSeriesEntry` pipeline unchanged.
3. **Variant 1 must restore progressive 30 s chunk loading** (the regression).
4. Variant 4 (lightweight-charts) is **explicitly NOT now** — mentioned only for scale/direction.
This is plan-worthy (cross-project, multi-variant): consider `/aif-plan` first (plan → STOP, implement in a separate session per the user's workflow).

## 5. Working discipline
- **Confirm before consequential/multi-file changes; show diffs.** The user is hands-on and corrects sharply — surface honest tradeoffs, don't over-defend a choice (e.g. ECharts vs lightweight-charts was answered candidly).
- **Never commit without explicit permission** (global rule). Only `chartOption.ts` is uncommitted now.
- **Plan → STOP**: `/aif-plan` produces the plan file as the deliverable; implement in a separate `/aif-implement` session.
- All files in English. Russian conversation is fine; artifacts stay English.
- The user wants to **hold all variants at once and test**, not have one picked for them — design the toggles as first-class, not a throwaway.

## 6. Error log
- **Inverted the sawtooth diagnosis.** I claimed zoom-out = smooth / zoom-in = sawtooth. CORRECT: **zoom-out (aggregated min/max envelope) = sawtooth; zoom-in (raw) = smooth.** The mechanism is right (min/max envelope drawn as one polyline = zigzag); only the which-view labels were swapped.
- **Proposed `sampling:'minmax'→'lttb'` as the sawtooth fix — WRONG layer.** ECharts `sampling` is threshold-gated: it only acts when a series has MORE points than the grid's pixel width. The aggregated overview (~900–1800 pts) is BELOW that threshold → `sampling` is a no-op there, so changing it did nothing visually (the user confirmed). The sawtooth is **in the DATA** (server emits min-point then max-point per bucket), not in client rendering. Real fix = server emits ONE point/bucket (avg or LTTB), or the client collapses each min/max pair. `lttb` is still correct for the raw deep-zoom path (where sampling DOES engage) — kept, but it is not the fix for the reported symptom.
- **Recommended "block Phase 20" during milestone-rescue** on the assumption the API gate (Phase 48) hadn't shipped. The user corrected: Phase 48 was done and verified, so implementing was correct. Verify gate status before declaring something premature.

## 7. Orientation
- **THREE biometric hooks now coexist — easy to confuse:** `useBiometricChunks` (RAW 30 s chunks, legacy; the one Variant 1 restores), `useBiometricOverview` (M2 base: ONE full-session aggregate via RQ), `useBiometricAggregate` (M3 overlay: window-scoped finer aggregate via RQ). Know which one a variant uses.
- **"minmax" is overloaded across two layers:** ECharts client `sampling:'minmax'` (render-time decimation) vs the SERVER min/max ENVELOPE (2 synthetic samples/bucket baked into the data). The sawtooth is the **server** one. Don't conflate.
- **"smoothing"/"MA":** the user explicitly wants a **non-lagging** smoother (centered/zero-lag MA or LTTB), NOT a trailing moving average (which lags). Variant 3 must not lag.

## 8. Domain model spine
- **Sawtooth root cause (settled — note 32 + §6):** server min/max envelope (min then max per bucket) rendered as a single line = zigzag, visible at zoom-out; raw zoom-in is smooth. Do not re-litigate the mechanism.
- **base ⊕ overlay (note 32, committed):** immutable coarse base + window overlay, render `detail ?? base`, resolution derived from zoom span, aggregated fetches via React Query keyed by `(window, bucketSec)`, single discriminated-union view-state. The toggle testbed sits ON TOP of this pipeline (swap the data source), it is not a rewrite.
- **Render pipeline is data-source-agnostic:** all endpoints return `BioSampleDto[]` (`{ timestamp, sampleType, data }`), so raw / min-max / smoothed all flow through `byType → toSeries(field) → buildLineSeriesEntry` unchanged. A variant = a different loader + endpoint, same renderer.
- **`motion` ≈ 95 % of total sample volume** (816k/860k; worst session 389k) → the raw path ALWAYS needs decimation; this is why client `sampling`/`large`/`progressive` exist.

## 9. Hard rules
- Never commit without explicit user permission.
- All generated/edited files in English.
- `mind_web`: every HTTP call through `core/api/client.ts` (no raw `fetch`); logs through the `logger` facade (`@/core/observe`), never `console.*`; browser storage only in the allowlisted auth/client files; `mind_auth_token` localStorage key must not be renamed; shared components receive data as props (page-level hooks own `useQuery`).
- Cross-project: `mind_api/proto` is the single source of truth for `.proto`; any API contract change starts in mind_api. The smoothed-aggregation endpoint is a mind_api change — coordinate, don't implement web against a non-existent endpoint (that exact mistake produced the rolled-back slug-46).

## 10. Cross-cutting contracts / invariants checklist
- **Endpoint surface — all three must coexist (the user's hard requirement):**
  - `GET /sessions/runs/:id/biometrics?from=<ISO>&to=<ISO>` → RAW samples (client chunks into 30 s windows). EXISTS.
  - `…?bucketSec=<n>` → MIN/MAX envelope: 2 synthetic `BioSampleDto`/bucket/sampleType, distinct in-bucket timestamps (min before max), every numeric field present. EXISTS (current default; the sawtooth).
  - `…?bucketSec=<n>&agg=avg|lttb` → SMOOTHED: ONE `BioSampleDto`/bucket/field (avg or server-side LTTB). **NEW — mind_api must add this** (api note 58 currently only specifies min/max).
- All variants return the same `BioSampleDto[]` shape → identical client render path.
- `bucketPolicy.ts` is the single owner of zoom→`bucketSec` + `quantizeWindow` (RQ cache key unit) — reuse it across variants, don't re-derive.

## 11. Per-unit map with watch-points
The toggles live **above the chart** (in/near `SessionCharts.tsx`); the user wants to flip between them and compare. Each:

- **Toggle 1 — "Raw / legacy (30 s chunked)":** all RAW samples, progressively loaded in 30 s chunks via `useBiometricChunks` + `?from&to`. *Watch-point:* this is the REGRESSED behavior — the base overview (M2) made the chart wait for the whole session; Variant 1 must restore the chunk-by-chunk progressive render (chart shows first 30 s immediately, fills as chunks arrive). Confirm the eager-load removal from M3 didn't permanently disable progressive raw.
- **Toggle 2 — "Current / min-max aggregate (sawtooth)":** the live base⊕overlay path, `?bucketSec=<n>` → min/max envelope. *Watch-point:* this IS the sawtooth — keep it as-is for comparison; do not "fix" it here, its whole purpose is to be the A/B baseline.
- **Toggle 3 — "Smoothed (non-lagging)":** `?bucketSec=<n>&agg=avg|lttb` → one point/bucket. *Watch-point:* must be NON-lagging — prefer server LTTB or a centered MA; a trailing MA lags and will be rejected. Half the payload of min/max and no sawtooth. Depends on the NEW API param.
- **Toggle 4 — "lightweight-charts" (FUTURE, DO NOT BUILD NOW):** same data in TradingView lightweight-charts. *Watch-point:* mentioned only for scale. Real migration cost: no multi-grid (would need N synced chart instances for the stacked grids) and no custom series (phase bars use ECharts `renderItem` rect+text — no equivalent). Scope as a project later, not now.
- **Progressive-load regression (cross-cutting):** the perceived-load win the user misses is "see the first 30 s instantly." Any variant on the raw path should preserve that; the aggregated variants load in one request (acceptable because the payload is small).
