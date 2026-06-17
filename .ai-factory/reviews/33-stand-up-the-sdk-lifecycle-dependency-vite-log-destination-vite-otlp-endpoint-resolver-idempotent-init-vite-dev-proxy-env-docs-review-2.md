# Code Review (Pass 2): Stand up the SDK lifecycle (observe-js OTLP)

**Scope reviewed:** `src/core/observe/{config,init,index}.ts`, `src/main.tsx`, `vite.config.ts`, `.env.example`, `docs/observability.md`, `CLAUDE.md`, `package.json`, `package-lock.json`. Code is unchanged since review-1; this pass goes deeper into SDK runtime behavior to confirm (or refute) the items review-1 marked "fine."

## Deep verification performed this pass

Read the resolved SDK bundle (`node_modules/observe-js/dist/browser.mjs`) to validate the three runtime assumptions the integration relies on:

1. **Relative endpoint does not throw.** The endpoint is never passed to `new URL()` anywhere in the browser bundle (`grep "new URL(" browser.mjs` → no matches). It flows directly into `fetch(endpoint, …)` and `navigator.sendBeacon(endpoint, blob)`, both of which accept origin-relative paths in the browser and resolve them against the document base. So `endpoint: '/otlp/v1/logs'` is safe — the SDK's `InitOptions` doc comment ("Full OTLP logs endpoint URL") is illustrative, not a constraint. The same-origin dev-proxy design is sound.

2. **`init` is genuinely first-wins and never throws on a double call.** `init()` (`browser.mjs:339`) guards on a module-level `_initialized` flag: a second call reports `init() called more than once` via `opts.onError` and returns — no throw, no duplicate listeners/exporters. So relying on the SDK's idempotency (rather than a local guard in `init.ts`) is correct, including under React 18 `StrictMode` (though `initObserve()` runs outside render and isn't double-invoked anyway).

3. **Export failures degrade silently.** The internal exporter wraps `fetch` in try/catch and routes any error (non-2xx, timeout via `AbortSignal.timeout`, network) to `onError` only; the batcher is bounded (`maxQueueSize` default 2048, drop-oldest). Nothing propagates to the app. Confirmed the unload flush (`pagehide` + `visibilitychange=hidden`) is registered inside the SDK (`browser.mjs:486-487`), so the plan's decision NOT to implement unload/flush in app code is correct.

Plus the static checks from pass 1, re-confirmed: `npm run typecheck` clean, `npm run lint` clean, `InitOptions` type fields match the call site, `dist/browser.mjs` present and exporting `init`, lockfile pins commit `a42a85c…`, proxy prefix `/otlp` aligns with both the endpoint path and Loki's native OTLP route (no `rewrite` needed).

**Conclusion: no bugs, security issues, or correctness problems in the changed code.** The implementation matches the spec exactly (never-throwing resolver, hard `file` default, gated idempotent init, no unload/flush, zero app log lines).

## Findings (carried from review-1, still open — neither blocks the observe changes)

### 1. [Minor / portability] Lockfile pins `observe-js` over SSH while `package.json` uses HTTPS
`package.json` declares `git+https://…/observe-js.git#v0.1.0`, but `package-lock.json:2911` resolved to `git+ssh://git@github.com/mind-systems/observe-js.git#a42a85c…` (npm honored a local `url."git@github.com:".insteadOf` rewrite). A `npm ci` in an environment that authenticates to GitHub over HTTPS (token-based CI) but has no SSH key for this private org will fail to install. The local machine that generated the lockfile is unaffected. Action: verify install on shared CI before merge, or normalize the lockfile `resolved` URL to `git+https://`. This is the repo's first git dependency, so CI has never exercised this path.

### 2. [Pre-existing / out of scope] `npm run build` is red, independent of this change
`npm run build` runs `tsc -b && vite build`; `tsc -b` fails first on `src/pages/SessionsPage/transforms.ts:50` (`TS2322: number[][] not assignable to [number, number][]`). That file is not touched by this task (`git status`), and `npm run typecheck` (root tsconfig) passes — the build-mode project config is stricter. Not introduced here, but it means a full `npm run build` cannot currently exercise Vite's resolution of the `observe-js` `browser` export end-to-end (the sandbox also runs Node 18.15.0, below Vite's required 20.19+). Resolution was therefore confirmed statically (exports `browser` condition → `dist/browser.mjs`, present, exports `init`; Vite's default conditions include `browser`). Recommend a one-time `npm run dev` smoke check on Node 20+ with `VITE_LOG_DESTINATION=both` to confirm `service.start` reaches Loki, per the note's DoD.

## Notes (no action)
- `logDestination` / `logToConsole` are exported-but-unused by design — consumed by the logger facade in the follow-up task.
- `onError`'s `console.error` in DEV is an SDK error handler, not an app log line; consistent with the "zero app log lines" guard.
- ES module imports in `main.tsx` (incl. `@/core/config`, which throws if `VITE_API_BASE_URL` is unset) evaluate before `initObserve()` due to hoisting; inherent to ES modules and harmless — the "before `createRoot`" requirement is satisfied.
