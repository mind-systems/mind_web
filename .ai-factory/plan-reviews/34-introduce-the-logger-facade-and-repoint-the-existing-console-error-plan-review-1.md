# Plan Review: Introduce the `logger` facade and repoint the existing `console.error`

## Code Review Summary

**Files Reviewed:** 1 plan + 5 source files (`config.ts`, `init.ts`, `index.ts`, `useBiometricChunks.ts`, observe-js type defs)
**Risk Level:** 🟢 Low

The plan is accurate, minimal, and well-grounded in the actual codebase. Every assumption it makes was verified against the real files. It correctly anticipates the two known footguns of this project (`verbatimModuleSyntax: true` and `@typescript-eslint/no-unused-expressions`).

### Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** PASS. The dependency direction is legal — `pages/SessionsPage/useBiometricChunks.ts` importing from `core/observe` follows the documented `pages → core/*` rule. The facade lives in `core/`, which is the correct home for shared infrastructure. No layering violation.
- **Rules:** No `.ai-factory/RULES.md` present (WARN — optional file absent). Project rules in CLAUDE.md (all files English, HTTP only via `core/api/client.ts`, storage only in auth/client) are not affected by this change.
- **Roadmap (`.ai-factory/ROADMAP.md`):** Present. This is observability plumbing tied to note 20; the plan correctly scopes itself as a follow-on. No missing milestone linkage that blocks the work.

### Verified Assumptions (all correct)

1. **note-20 resolver exists and exports the expected symbols.** `config.ts` exports `logToConsole`, `logToObserver`, `logDestination`, `otlpEndpoint`. The plan's instruction to reuse `logToConsole`/`logToObserver` and NOT re-read `import.meta.env` is correct and aligns with the resolver design.
2. **`index.ts` barrel currently exports only `initObserve`** — so `export { logger } from './logger';` is additive and accurate (Task 2).
3. **observe-js `log` signature matches.** `declare function log(level: Level, msg: string, attrs?: Record<string, unknown>): void;` — exactly the shape the facade calls.
4. **`Level` type is `'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'`** — covers `info/warn/error`.
5. **The single `console.error` site is real and matches the description** — `useBiometricChunks.ts` lines 118–121, inside the `.catch((err: unknown) => {...})` block (lines 115–123), with the stale-guard (line 116) and `loadedRef.current.add(idx)` (line 122) exactly as the plan describes. The trailing `:` on the message string (line 119) is correctly called out for removal.
6. **`verbatimModuleSyntax: true`** is set in `tsconfig.app.json` — the plan's split-import instruction (`import { log }` value + `import type { Level }`) is justified and necessary.
7. **`@/` path alias** resolves to `src/*` (`tsconfig.app.json` paths) — `import { logger } from '@/core/observe'` is valid.
8. **`no-console` is not enforced** — `init.ts` already uses `console.error` and passes lint, so the facade's internal `console.*` calls will not trip ESLint. `@typescript-eslint/no-unused-expressions` is the live concern, and the plan's nested `if/else` (not a ternary expression statement) correctly avoids it.

### Critical Issues

None.

### Minor Notes (non-blocking)

1. **`ConsoleFn` type is referenced but never defined.** Task 1's `emit` signature uses `consoleFn: ConsoleFn`, but the plan does not instruct the implementer to declare the `ConsoleFn` type. It is trivially inferable (e.g. `type ConsoleFn = (msg: string, attrs?: Record<string, unknown>) => void;` or `typeof console.info`), and `console.info/warn/error` all accept `(...data: any[])` so either call form (`consoleFn(msg, attrs)` / `consoleFn(msg)`) type-checks. Worth adding one line to Task 1 so the acceptance gate (`npm run typecheck`) is unambiguous, but not a blocker.

2. **`Level` is not exported from observe-js's *browser* entry point** (`dist/browser.d.ts` omits it from its export list; `dist/node.d.ts` exports it via `core.js`). This is safe here: with `moduleResolution: "bundler"` and no `customConditions`, TypeScript does not activate the `browser` condition, so the type checker resolves `observe-js` to `node.d.ts` where `Level` *is* exported — typecheck will pass. And because `Level` is imported as `import type`, it is erased before Vite applies the `browser` condition at bundle time, so the runtime split is irrelevant. No action needed; flagged only so the implementer isn't surprised if they inspect `browser.d.ts` directly. If typecheck ever fails on the `Level` import, the fallback is to inline the union type locally rather than import it.

### Positive Notes

- Tasks are correctly ordered with explicit dependencies (Task 2 → Task 1, Task 3 → Task 2).
- The plan enforces strict scope discipline: "ZERO new log lines beyond rerouting the one site," no `try/catch` around `log`, facade named `logger` (never shadowing the SDK's `log`). These guards prevent scope creep and the classic log-loop mistake.
- Behavior-preservation is explicit: the stale-guard and `loadedRef.current.add(idx)` are kept verbatim; only the `console.error` expression is swapped. The soft-error semantics are unchanged.
- Acceptance gate (`npm run lint && npm run typecheck`) is concrete and matches the project's actual scripts.

PLAN_REVIEW_PASS
