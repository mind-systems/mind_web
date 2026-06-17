# Code Review: Mint a span + inject `traceparent` inside `apiFetch`

**Plan:** `36-mint-a-span-inject-traceparent-inside-apifetch.md`
**Changed source files:** `src/core/api/client.ts` (the feature), `src/pages/SessionsPage/transforms.ts` (unrelated, see §3)
**Verdict:** No blocking findings. Implementation matches the plan and the verified SDK behavior.

## What was reviewed
- `git diff HEAD` / `git status` — only two non-doc files changed: `src/core/api/client.ts` and `src/pages/SessionsPage/transforms.ts`. (The rest are `.ai-factory/` plan + plan-review markdown/JSON.)
- Both source files read in full.
- `observe-js` runtime (`dist/browser.mjs`) and type surface (`dist/node.d.ts`) inspected to confirm the chosen API actually does what the code assumes.
- `npm run typecheck` ✅ clean, `npm run lint` ✅ clean.

## 1. `src/core/api/client.ts` — correct

The implementation matches the plan exactly and is behaviorally sound:

- **Header merge order preserved.** `baseHeaders` keeps `Content-Type` → `Authorization` → `...options?.headers`, identical to the pre-change inline literal. No regression to existing request shape.
- **`file`-mode path byte-for-byte unchanged.** When `logToObserver` is false, `headers = baseHeaders` (the same plain object the old code built), so default-mode requests carry no `traceparent` and are unaffected.
- **Inject is synchronous before the `await`.** `inject(headersCarrier(traced), startSpan())` runs fully before `await fetch(...)`, so the `trace_id` is in the headers at call time. ✔ matches the plan's hard guard.
- **Fresh span per call.** `startSpan()` is invoked inline on every `apiFetch`; no reuse, no app-wide `runWithContext`. ✔
- **Explicit-`ctx` form is robust as claimed.** Verified in `dist/browser.mjs`:
  - `inject(carrier, ctx)` → `const active = ctx ?? getActiveContext()` (line 273). Passing `startSpan()` as `ctx` means injection never depends on the installed context manager, so it is immune to the `"sideEffects": false` tree-shaking trap the plan describes. ✔
  - `startSpan()` with no active context returns `{ traceId: newTraceId(), spanId: newSpanId(), traceFlags: 1 }` (lines 233-237) — a valid random trace id **without** requiring `init()`. `formatTraceparent` then emits a well-formed `00-<32hex>-<16hex>-01` header (lines 254-257). So the gated path produces a valid `traceparent` even when `initObserve()` was skipped (which it is unless `otlpEndpoint` is set). ✔
- **`new Headers(baseHeaders)` is valid.** `baseHeaders` is typed `HeadersInit`, which the `Headers` constructor accepts; `headersCarrier` wraps `Headers.set`. Typecheck confirms.
- **401 / error paths untouched.** ✔
- **Zero new log lines.** No `logger`/`log` calls added. ✔

No correctness, security, or race issues. The only state captured per call is a fresh span; there is no shared mutable trace context.

## 2. Minor observations (non-blocking)

- **`...options?.headers` spread semantics are unchanged but worth knowing.** If a caller ever passed `options.headers` as a `Headers` instance or `[string, string][]` tuple array, the object-spread would not merge it as expected — but this behavior is identical to the pre-change code (it spread the same way into the inline literal), and all current callers pass plain objects. No regression introduced; flagged only so it isn't mistaken for new behavior.
- **Production-build DoD step could not be exercised here.** `npm run build` runs `tsc -b && vite build`; the `tsc -b` half passed, but `vite build` aborts in this environment with `CustomEvent is not defined` because Node 18.15.0 is below Vite's required 20.19+. This is a pre-existing environment limitation, **not** caused by this change, and the explicit-`ctx` form is structurally immune to the tree-shaking concern the build step was meant to catch. The plan's manual DoD (build + preview in `grafana` mode, confirm the `traceparent` header in DevTools) should still be run on a Node ≥20.19 machine before enabling `grafana`/`both`, alongside the documented mind_api CORS allow-list check for `traceparent`.

## 3. `src/pages/SessionsPage/transforms.ts` — out of scope, benign

The diff adds an `as [number, number]` cast to the `toSeries` `.map()` callback:
```ts
.map((s) => [..., s.data[field] as number] as [number, number])
```
This is unrelated to the trace-origination plan (it predates this task in the working tree). It is correct: without the cast the array literal widens to `number[]`, which is not assignable to the declared `[number, number][]` return type. Pure typing fix, no runtime behavior change. No issue.

## Verification summary
- `npm run typecheck` — clean
- `npm run lint` — clean
- SDK behavior (`startSpan`, `inject`, `headersCarrier`, `formatTraceparent`) confirmed against `node_modules/observe-js/dist/browser.mjs`
- All plan guards (sync-before-await, fresh span per call, gated on `logToObserver`, no new logs, file-mode unchanged) hold in the code.

REVIEW_PASS
