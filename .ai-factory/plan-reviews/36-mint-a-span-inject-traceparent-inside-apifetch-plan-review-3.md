# Plan Review 3 — Mint a span + inject `traceparent` inside `apiFetch`

## Code Review Summary

**Plan reviewed:** `36-mint-a-span-inject-traceparent-inside-apifetch.md`
**Files targeted:** `src/core/api/client.ts` (1 file)
**Risk Level:** 🟢 Low

This is the third review. Plan v1 and v2 blockers are all resolved in the current plan text, and every substantive technical claim has been verified against the actual installed package and tsconfig.

### Context Gates

- **Architecture (WARN, acknowledged):** Introduces a new intra-`core` edge `core/api → core/observe`. The documented matrix in `ARCHITECTURE.md` (`core/api → core/config, core/types`) does not list it. Verified at `ARCHITECTURE.md` lines 50–60 — the rule block omits `core/observe`. The edge is benign (core→core, no layering inversion). The plan flags it as an opportunistic doc update. Non-blocking.
- **Rules (PASS):** No raw `fetch` introduced outside `core/api`; no new `localStorage` access; `logToObserver` is sourced from `@/core/observe/config`, not re-read from env. Complies with `mind_web/CLAUDE.md` storage/HTTP/config rules.
- **Roadmap (WARN, acknowledged):** This is ROADMAP.md Phase 14 (lines 99–103). The roadmap text prescribes `withTraceparent(baseHeaders)`; the plan intentionally overrides that and notes the roadmap entry should be corrected when next touched. Verified the roadmap line does say `withTraceparent`. The override is correct (see verified findings below). Linkage is explicit. Non-blocking.

### Critical Issues

None.

### Verified Technical Claims (all confirmed correct)

1. **`withTraceparent` is browser-only and would break the typed build — confirmed.** `grep` shows `withTraceparent`/`tracedFetch` exist only in `dist/browser.d.ts` (line 275/289), and `dist/node.d.ts` re-exports `startSpan, inject, headersCarrier, withSpan` but not `withTraceparent`. With `tsconfig.app.json` using `moduleResolution: "bundler"` and no `customConditions`, tsc does not enable the `browser`/`node` export conditions, so it resolves the package `"."` top-level `import` condition → `dist/node.d.ts`. Importing `withTraceparent` would raise TS2305 and fail `tsc -b`. The plan's avoidance instruction is accurate.

2. **`inject(headersCarrier(traced), startSpan())` typechecks — confirmed.** `Span` is `{traceId, spanId, parentSpanId?, traceFlags}` (core.d.ts:166); `inject`'s `ctx?: Context` param is `{traceId, spanId, traceFlags, traceState?}` (core.d.ts:124). `Span` carries all required `Context` fields, so it is structurally assignable. All three of `startSpan`/`inject`/`headersCarrier` are exported from `node.d.ts`.

3. **The explicit-`ctx` form is genuinely robust to tree-shaking — confirmed.** `package.json` declares `"sideEffects": false`, so the browser context-manager install side-effect is eligible for elimination in a production Rollup pass. `inject(carrier, ctx)` resolves `ctx ?? getActiveContext()`; passing `startSpan()` directly bypasses the ambient manager. And `startSpan()` opens a fresh root trace when no active context exists, so it always returns a real `traceId` even if the manager is tree-shaken — the header is still written. The reasoning holds end-to-end.

4. **`headersCarrier` requires a real `Headers` instance — confirmed** (core.d.ts:227, "Wrap a standard Headers object"). Wrapping `baseHeaders` in `new Headers(baseHeaders)` is correct; `Headers` is a web/Node global, no import needed.

5. **No behavioral regression in `file` mode — confirmed.** Current `client.ts` (lines 17–24) merges `Content-Type → Authorization → ...options?.headers` into an inline literal. The plan's `baseHeaders` reproduces that exact order, and in `file` mode passes it as-is. Gated path only adds the `traceparent` header. `{ ...options, headers }` correctly lets the merged headers win over `options.headers`.

6. **`noUnusedLocals` compliance — confirmed.** The plan imports only `startSpan, inject, headersCarrier` (all used in the gated block) and `logToObserver` (used as the gate); it explicitly does not import `withSpan`/`withTraceparent`. No unused-local violation.

### Minor Observations (non-blocking)

- **Pre-existing `Headers`-spread quirk (not introduced here):** if a caller ever passes `options.headers` as a `Headers` instance or `[k,v][]` array, the object-spread `...options?.headers` silently drops it. This is identical to today's behavior and the plan preserves it verbatim, so it is not a regression. Worth knowing, not worth blocking.
- **DoD is appropriately strict:** the plan correctly mandates a production-build verification (`npm run build` + `preview` with `grafana`/`both`) rather than a dev-server smoke test, since the runtime-vs-build traps are invisible to `npm run dev`. Good.

### Positive Notes

- Correct architectural placement: origination at the single HTTP choke point (`apiFetch`), never in components/handlers — matches `ARCHITECTURE.md` and `CLAUDE.md`.
- Both prior-review blockers (the `withTraceparent` build break and the context-manager/tree-shaking risk) are resolved with verifiable, correctly-reasoned fixes, and the plan reproduces the exact `node.d.ts` vs `browser.d.ts` export split as an implementer guard.
- Cross-project CORS dependency is explicit with a concrete pre-enable verification step, correctly scoped to only bite in `grafana`/`both`.
- Guards are precise: synchronous mint+inject before the `await`, fresh span per call, no app-wide `runWithContext`, zero new log lines, one-way correlation accepted as the honest floor.
- Doc deviations (roadmap text, architecture matrix) are surfaced rather than hidden.

### Verdict

The plan is correct, well-scoped, and ready to implement. All technical claims were verified against the installed `observe-js` types and the project tsconfig. The two WARN context gates (roadmap Phase 14 wording, architecture dependency-matrix edge) are acknowledged in the plan and can be addressed opportunistically when docs are next touched.

PLAN_REVIEW_PASS
