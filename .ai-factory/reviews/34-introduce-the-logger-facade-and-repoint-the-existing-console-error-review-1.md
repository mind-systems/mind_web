# Code Review: Introduce the `logger` facade and repoint the existing `console.error`

**Risk Level:** 🟢 Low
**Files reviewed (in full):** `src/core/observe/logger.ts` (new), `src/core/observe/index.ts`, `src/core/observe/config.ts`, `src/core/observe/init.ts`, `src/pages/SessionsPage/useBiometricChunks.ts`, plus the observe-js type defs (`browser.d.ts`, `node.d.ts`) and `tsconfig.app.json`.

## Summary

The change implements the plan exactly: a thin `logger` facade in `core/observe`, an additive barrel re-export, and the single `console.error` site in `useBiometricChunks.ts` rerouted through it. Scope is minimal — no new log lines, no behavior change in the drain loop. Both acceptance gates pass locally:

- `npm run typecheck` → clean.
- `npm run lint` → clean.

No correctness, security, or runtime bugs found.

## Verification performed

- **Lint gate (the round-1/round-2 concern).** The implemented `emit` uses the nested `if/else` form, not the spec note's ternary-as-statement. `eslint .` passes, confirming `@typescript-eslint/no-unused-expressions` is satisfied.
- **`import type { Level }` resolution.** `Level` is declared in `browser.d.ts` but **not** in its export list; it *is* exported from `node.d.ts`. Under `moduleResolution: "bundler"` (no `customConditions`), TypeScript does not activate the `browser` export condition, so it resolves the package types to `node.d.ts` where `Level` is exported — typecheck passes. At runtime Vite picks the `browser` build (`browser.mjs`), but `Level` is a `import type` and is erased before bundling, while `log` *is* exported by the browser build. The value/type split is correct; nothing is left dangling at runtime.
- **`verbatimModuleSyntax: true`.** The split imports (`import { log }` value + `import type { Level }`) are required and present.
- **`ConsoleFn` assignability.** `console.info/warn/error` (`(message?: any, ...optionalParams: any[]) => void`) are assignable to the local `ConsoleFn` param type; confirmed by the passing typecheck.
- **`log` signature match.** SDK declares `log(level: Level, msg: string, attrs?: Record<string, unknown>): void` — exactly the facade's call shape.
- **Drain-loop behavior preserved.** In `useBiometricChunks.ts` the `fetchIdRef.current !== myFetchId` stale-guard, the explanatory comment, and `loadedRef.current.add(idx)` are unchanged; only the `console.error(...)` expression was swapped for `logger.error(...)`. Soft-error semantics (mark attempted, never retry) are identical.

## Findings

None blocking.

### Non-blocking observations (no action required — design-level, documented in notes 20/21)

1. **Console output shape change (intentional).** `console.error(msg, err)` → `console.error(msg, { err })`. The raw error is now wrapped in an object in console output rather than passed as a bare second arg. Devtools still expands it; note 21 explicitly calls this out as moving `err` into structured `attrs`. Not a regression.

2. **Misconfiguration edge: `destination=grafana` with no endpoint.** When `VITE_LOG_DESTINATION=grafana` but `VITE_OTLP_ENDPOINT` is blank, `config` yields `logToObserver=true, logToConsole=false`, but `initObserve()` early-returns (gated on `otlpEndpoint`), so `init()` is never called. The facade then calls `log(...)` (gated only on `logToObserver`), which the SDK drops silently for pre-`init` records (it never throws). Net effect: in that specific misconfiguration, error logs go neither to console nor to Loki. This is inherent to the note-20 "silent degrade, never block the app" design (the facade intentionally depends only on `logToObserver`, not on whether `init` succeeded), not a defect introduced by this change. The default destination is `file`, so the common path is unaffected.

## Positive notes

- Strict scope discipline: exactly one call site rerouted, no `try/catch` around `log`, facade named `logger` (no SDK `log` shadow), env read only via the reused resolver.
- Barrel re-export is additive and ordered before its consumer.
- Both project quality gates pass with no warnings.

REVIEW_PASS
