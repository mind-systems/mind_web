# Plan Review: Stand up the SDK lifecycle (observe-js OTLP)

**Plan:** `33-stand-up-the-sdk-lifecycle-...-vite-dev-proxy-env-docs.md`
**Risk Level:** 🟢 Low
**Verdict:** Solid — proceed. Only minor, non-blocking notes below.

## Scope Verified Against Codebase

- **Reference note** `.ai-factory/notes/20-observe-sink-lifecycle-init.md` exists and matches the plan task-for-task (resolver/init/index, main.tsx wiring, dev proxy, env, docs).
- **Roadmap linkage present.** This plan is the exact Phase 13 task 1 entry in `.ai-factory/ROADMAP.md` (line 95). No missing linkage.
- **`@` alias resolves.** `vite.config.ts` has `resolve.alias['@']` and `tsconfig.app.json` has `baseUrl`/`paths` (`@/*` → `src/*`), so `import { initObserve } from '@/core/observe'` (Task 5) works.
- **`src/main.tsx`** is exactly as the note describes — bare `createRoot` after providers, no existing logging. Adding `initObserve()` as the first statement is clean and side-effect-correct.
- **`src/core/config.ts`** indeed throws on a missing var — the "never throw" contrast for the new resolver (Task 2) is accurate.
- **`vite.config.ts`** has no `server` block today; adding `server.proxy` (Task 6) is additive and non-breaking. Target `http://localhost:3100` matches the note's Loki port.
- **`package-lock.json`** exists, so `npm install` will update the lockfile as Task 1 expects.

## Context Gates

### Architecture (`.ai-factory/ARCHITECTURE.md`) — WARN
- New `src/core/observe/` submodule is consistent with the `core/` infrastructure layer and respects dependency rules (it imports only from `observe-js` and itself; it does not import from `pages/` or `components/`). main.tsx → core is allowed.
- WARN: the ARCHITECTURE.md "Folder Structure" block lists only `core/api`, `core/auth`, `core/types`, `core/config`. `core/observe/` is not mentioned. Not a blocker (the note establishes the module), but ARCHITECTURE.md will drift. Consider a one-line addition in a later docs pass.

### Rules (`.ai-factory/rules/base.md`, `mind_web/CLAUDE.md`) — PASS
- "No console.log in production code": the only `console.error` is in `init.ts`'s `onError`, guarded by `import.meta.env.DEV`, so it never fires in prod builds. Compliant.
- "All env vars prefixed with `VITE_`": `VITE_LOG_DESTINATION` / `VITE_OTLP_ENDPOINT` comply, and the plan documents the prefix requirement (Task 8).
- "`.env.local` gitignored; `.env.example` committed": Task 7 appends to `.env.example` only and explicitly leaves `.env.local` untouched. Compliant.
- Storage allow-list rule is untouched — no `localStorage`/`sessionStorage` access introduced.

### Roadmap (`.ai-factory/ROADMAP.md`) — PASS
- Directly implements Phase 13 task 1; the follow-up logger facade is correctly deferred to task 2 (Phase 13 line 97). Atomicity boundary (lifecycle ships observable via `service.start`, facade later) is respected.

### Docs path — PASS (resolved)
- `.ai-factory/config.yaml` sets `paths.docs: docs/`, so `docs/observability.md` (Task 8) is the configured docs location even though the directory does not yet exist. The implementer will create it. No finding.

## Minor Notes (non-blocking)

1. **Wording inconsistency on `import.meta.env` confinement.** Task 2 says "Keep all `import.meta.env` access confined to this file" (`config.ts`), but Task 3 legitimately reads `import.meta.env.DEV` inside `init.ts`. The real, intended rule (per note 20's guard) is *module-level* confinement — all `import.meta.env` access stays inside `src/core/observe/`. Reword Task 2 to "confined to this module" to avoid the implementer thinking Task 3 violates it.

2. **`mind_web/CLAUDE.md` path in Task 8.** The path is written relative to the monorepo root. This plan is mind_web-scoped and will be implemented from inside `mind_web/`, where the file is just `CLAUDE.md`. No ambiguity about *which* file, but the implementer should edit `./CLAUDE.md`, not create a nested `mind_web/CLAUDE.md`.

3. **External dependency is unverifiable here.** Task 1 pins `git+https://github.com/mind-systems/observe-js.git#v0.1.0` and relies on its `prepare` hook building `dist/` and a `browser` export condition. This can't be verified from this repo; the note states it was verified against the `v0.1.0` source tree. The plan's smoke-check (`import { init } from 'observe-js'` resolves under Vite) is the right gate. No action needed beyond running it.

4. **StrictMode double-init — already safe.** `initObserve()` runs before `createRoot`, outside React's render tree, so StrictMode's double-invocation does not double-call it; the SDK's first-wins idempotency is a belt-and-suspenders backstop. No change needed.

## Positive Notes

- Excellent guard discipline: never-throw resolver, hard `file` default (not `DEV`-conditional), no local idempotency guard, no unload/flush re-implementation, zero new app log lines — all explicit and matched to the note.
- Same-origin dev-proxy approach correctly solves the `sendBeacon`/preflight problem with zero backend change.
- Commit plan is coherent and maps cleanly onto the task phases.

PLAN_REVIEW_PASS
