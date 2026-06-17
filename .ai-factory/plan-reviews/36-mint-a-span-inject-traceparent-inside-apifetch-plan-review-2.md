# Plan Review 2: Mint a span + inject `traceparent` inside `apiFetch`

**Plan:** `36-mint-a-span-inject-traceparent-inside-apifetch.md`
**Target:** `mind_web/src/core/api/client.ts`
**Risk Level:** 🟡 Medium — all blockers from review-1 are resolved; one latent production-build risk and minor doc-linkage gaps remain.

## What changed since review-1 (all prior issues resolved)

- **Issue 1 (BLOCKING) — `withTraceparent` import → TS2305.** Fixed. The plan now imports `startSpan, withSpan, inject, headersCarrier` and includes an explicit "Do NOT import `withTraceparent`" callout explaining the `moduleResolution: "bundler"` / no-`customConditions` resolution to `dist/node.d.ts`. Re-verified against the installed package:
  - `node.d.ts` exports: `... headersCarrier, inject, startSpan, withSpan ...` — **no** `withTraceparent`/`tracedFetch`.
  - `browser.d.ts` exports: `... withTraceparent, tracedFetch ...`.
  - The chosen four exports all typecheck cleanly. ✅
- **Issue 2 — cross-origin CORS for `traceparent`.** Fixed. The plan adds a dedicated "Cross-project dependency: mind_api CORS" section with a concrete verification step before enabling `grafana`/`both`. ✅
- **Issue 3 — SDK-determined sampling flag.** Fixed. Captured in Notes/Guards. ✅

The corrected `inject` + `headersCarrier` logic is sound: `inject(carrier)` (no `ctx`) reads the active context, and the SDK's `inject` writes `traceparent` (and `tracestate` if present) into the carrier (verified in `chunk-3E4UPOKO.mjs:272-279`). API signatures match the plan's usage exactly.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ⚠️ **WARN.** Placement is correct — origination at the single fetch choke point (`core/api/client.ts`), matching the "Single fetch point" principle. However, the plan introduces a **new intra-`core` dependency edge** `core/api → core/observe` (the `import { logToObserver } from '@/core/observe/config'`). The documented dependency matrix lists only `core/api → core/config, core/types` (ARCHITECTURE.md line 53). This edge is benign (core→core, no layering inversion) but is not in the matrix. Consider updating the matrix when docs are next touched. Non-blocking.
- **Rules (`.ai-factory/RULES.md`):** ⚠️ File not present. `CLAUDE.md` rules respected: all-English, `mind_auth_token` untouched, no raw `fetch` added, no new `localStorage` access, all HTTP still through `client.ts`.
- **Roadmap (`.ai-factory/ROADMAP.md`):** ⚠️ **WARN (carryover).** This is **Phase 14** work ("Observability logging: outbound trace origination", ROADMAP.md line 99-103). The plan references only "Phase 13 sink" and "this phase" without naming Phase 14. Worth an explicit linkage line. Note also that the roadmap's own Phase 14 task text prescribes `withTraceparent(baseHeaders)` — the plan **correctly overrides the roadmap** here (that export breaks the typed build); the roadmap entry should eventually be corrected to match.
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** Not present — no project-specific overrides.

## Secondary Issues / Risks

### 1. `withSpan` context propagation depends on an import-time side-effect under `"sideEffects": false` (verify in a production build)

The corrected approach uses:
```ts
withSpan(startSpan(), () => inject(headersCarrier(traced)));
```
`withSpan` → `runWithContext(ctx, fn)` → `currentManager.with(ctx, fn)`. `inject` (called with no explicit `ctx`) then reads `getActiveContext()` to find the trace to write. This **only works if a real context manager is installed** — the default `noopManager.with(_ctx, fn)` just calls `fn()` without making the context active, and `noopManager.active()` returns `undefined`, in which case `inject` early-returns and **writes no header** (verified `chunk-3E4UPOKO.mjs:167-176, 272-279`).

The context manager is installed as a **top-level side-effect at module import time**, not by `init()`:
```js
// browser.mjs:430-431
var browserContextManager = createBrowserContextManager();
setContextManager(browserContextManager);
```
Good news: because this runs at import time, the inject works **even when `init()` is skipped** — recall `initObserve()` returns early unless `logToObserver && otlpEndpoint` are both set. So gating inject on `logToObserver` alone (without `otlpEndpoint`) is still safe at runtime. ✅

The risk: `observe-js`'s `package.json` declares **`"sideEffects": false`**. The `setContextManager(browserContextManager)` statement contributes to no *used* export (the app imports neither `browserContextManager` nor `setContextManager`), so a production Rollup/`vite build` pass is *permitted* to tree-shake it away — leaving `noopManager` active and `inject` silently writing nothing. This is the **same class of runtime-vs-build trap** review-1 caught with the typecheck: dev (no tree-shaking) would pass while the production bundle silently drops the header.

**Two options:**

- **Preferred (one-line hardening) — pass the span context explicitly and drop `withSpan`:**
  ```ts
  import { startSpan, inject, headersCarrier } from 'observe-js';
  // ...
  if (logToObserver) {
    const traced = new Headers(baseHeaders);
    inject(headersCarrier(traced), startSpan());
    headers = traced;
  }
  ```
  `inject(carrier, ctx)` uses `ctx ?? getActiveContext()`, so passing the span directly makes injection **independent of the context manager** — immune to tree-shaking, `init()` ordering, and any future `noopManager` fallback. Verified type-compatibility: `startSpan()` returns `Span` (`{traceId, spanId, parentSpanId?, traceFlags}`), which is structurally assignable to `inject`'s `Context` param (`{traceId, spanId, traceFlags, traceState?}`) — all required `Context` fields are present, and `startSpan`/`inject`/`headersCarrier` are all in `node.d.ts`, so this still typechecks under the project's resolution. This also removes the now-unused `withSpan` import (relevant: `noUnusedLocals` is enabled).
- **Alternatively**, keep the `withSpan` form but add an explicit **production-build verification step**: run `vite build` + `preview` in `grafana`/`both` mode and confirm an actual API request carries a `traceparent` header (DevTools → Network). A dev-server smoke test is insufficient to catch this.

This is not strictly blocking — the `withSpan` form works in `npm run dev` and may well survive production tree-shaking — but the explicit-`ctx` form removes the uncertainty entirely for the cost of one fewer import, so it is the recommended formulation.

### 2. `HeadersInit` annotation on the merged literal (low risk, preserve existing behavior)

The plan annotates `const baseHeaders: HeadersInit = { ...spread of options?.headers }`. The object-spread merge of `options?.headers` is preserved verbatim from the current code (today's line 19-23 spreads it the same way into the inline literal), so there is **no behavioral regression** — callers already must pass plain-object headers for the existing merge to work. The new explicit `: HeadersInit` annotation targets the same type the value is already assigned to today (`RequestInit.headers`), so it should typecheck. Just let the implementer confirm `npm run typecheck` is clean after the edit rather than assume it. Low risk.

## Things the Plan Gets Right (Positive Notes)

- All three review-1 findings are addressed with verifiable, correctly-reasoned fixes — including reproducing the exact `node.d.ts` vs `browser.d.ts` export split as a guard callout for the implementer.
- Correct architectural placement at the single HTTP choke point; no log lines, no call-site changes, no new storage access.
- Header merge order (content-type → auth → caller headers) preserved exactly; `{ ...options, headers }` correctly lets the merged `headers` override any `options.headers`.
- Gating on `logToObserver` keeps `file` (default) mode's request shape byte-for-byte unchanged.
- The CORS cross-project dependency is now explicit with a concrete pre-enable verification step — exactly the right containment (only bites in `grafana`/`both`).
- Guards are precise and correct: synchronous mint+inject before the `await`, fresh span per call, no app-wide `runWithContext`, one-way correlation accepted as the honest floor.

## Verdict

The plan is close to ready and materially improved over v1 — every prior blocker is genuinely fixed. The remaining substantive item is the **tree-shaking / context-manager dependency (Issue 1)**: adopt the one-line `inject(headersCarrier(traced), startSpan())` form (dropping `withSpan`) to make injection robust to production bundling, or add an explicit production-build verification step. Address the two WARN context gates (roadmap Phase 14 linkage, architecture dependency-matrix edge) opportunistically. With Issue 1 resolved, this is safe to implement.
