# Code Review: Stand up the SDK lifecycle (observe-js OTLP)

**Scope reviewed:** `src/core/observe/{config,init,index}.ts`, `src/main.tsx`, `vite.config.ts`, `.env.example`, `docs/observability.md`, `CLAUDE.md`, `package.json`, `package-lock.json`.

**Verification performed:**
- `npm run typecheck` → clean
- `npm run lint` → clean
- Confirmed `observe-js@v0.1.0` installed with `dist/browser.mjs` present and exporting `init`; lockfile pins commit `a42a85c…`.
- Cross-checked the SDK `InitOptions` type (`node_modules/observe-js/dist/browser.d.ts:180`) against the `init({project, service, endpoint, onError})` call site — all four fields exist and types match.
- Verified the Vite proxy prefix (`/otlp`) lines up with the endpoint path (`/otlp/v1/logs`) and Loki's native OTLP route, so no `rewrite` is needed.

The changed code matches the spec note (`.ai-factory/notes/20-observe-sink-lifecycle-init.md`) faithfully: resolver never throws, default is a hard `file`, init is gated on `logToObserver && otlpEndpoint`, idempotency is delegated to the SDK, no unload/flush is implemented, and no app log lines are added. No correctness or security bugs in the changed code.

Two non-blocking observations below.

## Findings

### 1. [Minor / portability] Lockfile pins `observe-js` via SSH while `package.json` uses HTTPS
`package.json` declares `git+https://github.com/mind-systems/observe-js.git#v0.1.0`, but `package-lock.json:2911` resolved it to `git+ssh://git@github.com/mind-systems/observe-js.git#a42a85c…`. npm rewrote the protocol (almost certainly via a local `url."git@github.com:".insteadOf` git config on the author's machine).

Impact: a clean `npm ci` in an environment that can reach the repo over HTTPS but has no SSH key for `mind-systems/observe-js` (e.g. CI, or a teammate without SSH access to the private org) will fail to install. This does not affect the local dev machine where the lockfile was generated.

Suggestion: not blocking for this task, but before this lands on shared CI, confirm the install works there, or normalize the lockfile `resolved` URL to `git+https://`. Worth a heads-up to whoever owns CI since this is the first git-dependency in the repo.

### 2. [Pre-existing, out of scope] `npm run build` is red due to `src/pages/SessionsPage/transforms.ts`
`npm run build` runs `tsc -b && vite build`. `tsc -b` fails before Vite is reached:

```
src/pages/SessionsPage/transforms.ts(50,3): error TS2322:
  Type 'number[][]' is not assignable to type '[number, number][]'.
```

This file is **not** touched by this task (confirmed via `git status`), and `npm run typecheck` (root tsconfig, `tsc --noEmit`) passes — the build-mode project config is stricter and surfaces it. So this is a pre-existing breakage, not introduced here, and outside this task's scope.

Consequence for this task's verification: because `tsc -b` aborts first, a full `npm run build` could not exercise Vite's resolution of the `observe-js` `browser` export end-to-end in this sandbox (Vite also can't run here — the sandbox has Node 18.15.0, below Vite's required 20.19+). Resolution was instead confirmed statically: the `browser` condition in the dep's `exports` points to `dist/browser.mjs` (present, exports `init`), and Vite's default resolve conditions include `browser`. Recommend a one-time manual `npm run dev` smoke check with `VITE_LOG_DESTINATION=both` on a Node 20+ machine to confirm the `service.start` marker reaches Loki, per the note's DoD.

## Notes (no action)
- `endpoint` is the relative path `/otlp/v1/logs`; the SDK type comment shows a full URL example, but browser `fetch`/`sendBeacon` accept relative URLs (resolved against the document origin) — this is the intended same-origin dev-proxy design, not a defect.
- `logDestination` / `logToConsole` are exported but currently unused; intentional, consumed by the logger facade in the follow-up task.
- In `main.tsx`, `initObserve()` is the first statement, but ES module imports (incl. `@/router` → `@/core/config`) are hoisted and evaluate before it. This is inherent to ES modules and harmless here (init only registers SDK state); the "before `createRoot`" requirement is satisfied.
