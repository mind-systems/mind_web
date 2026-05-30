# Plan Review: 05 — Configure React Router and page shells

**Plan:** `.ai-factory/plans/05-configure-react-router-and-page-shells.md`
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Plan respects the feature-based module layout. `core/auth` does not import from other `src/` folders. The page module pattern (`pages/<Page>/index.tsx`) matches the ARCHITECTURE.md folder example, including the new `MagicLinkPage` and `GoogleCallbackPage` which extend the LoginPage flow. `ProtectedRoute.tsx` placement in `components/` matches the architecture's own code example.
  - **WARN:** ARCHITECTURE.md's stated dependency rule `components/ → core/types only` conflicts with its own `ProtectedRoute` example which imports from `core/auth`. The plan follows the example (the more practical reading), which is the right call, but the conflict is in ARCHITECTURE.md, not the plan.
- **Rules (`.ai-factory/rules/base.md`):** ✅ Naming, environment, and auth conventions are all respected. `mind_auth_token` localStorage key preserved. Token access constrained to `core/auth`.
  - **WARN:** `base.md` module structure note says "one file per page" while ARCHITECTURE.md uses folder modules. The plan follows ARCHITECTURE.md (folder modules), which is the more specific source of truth — acceptable.
- **Roadmap (`.ai-factory/ROADMAP.md`):** ✅ Plan exactly maps to the Phase 1 milestone "Configure React Router and page shells". Routes (`/login`, `/deeplink-auth`, `/auth/google/callback`, `/sessions`, `/sessions/:id`, `/calibrations`, `/` → `/sessions`) match the roadmap line-for-line. Stub deferral to Phase 2 (`Auth context + token management`) for `login`/`logout`/`pendingEmail` is correctly scoped.

## Critical Issues

None.

## Findings

### Minor — version naming inconsistency

The plan repeatedly says "React Router v6". `package.json` actually pins `react-router-dom@^7.16.0`. The router APIs used (`createBrowserRouter`, `RouterProvider`, `useParams`, `Navigate`) are identical between v6 and v7 in this usage, so there is no functional impact. CLAUDE.md and ARCHITECTURE.md also say v6 — a project-wide naming drift to address separately, not a plan defect.

### Minor — `verbatimModuleSyntax: true` not flagged

`tsconfig.app.json` sets `verbatimModuleSyntax: true` and `noUnusedLocals: true`. This means the type-only imports needed by these stubs (`ReactNode` in `ProtectedRoute.tsx`) MUST use `import type { ReactNode } from 'react'` — a regular `import` will fail `tsc`. The plan does not explicitly call this out. Not a blocking issue (a competent implementer will do this), but worth a sentence in Task 2 to prevent a typecheck failure.

### Minor — `storage` event listener may be over-engineered for a stub

Task 1 specifies subscribing to the `window` `storage` event for cross-tab token sync. This is reasonable, but:
- It's a Phase 1 stub that Phase 2 ("Auth context + token management") will rewrite entirely with `login`/`logout`/`pendingEmail`.
- The `storage` event only fires in OTHER tabs, not the writing tab — so within this milestone (manual verification by editing localStorage) it would only help the multi-tab case, which is not exercised in Task 10's verification steps.

Acceptable to keep (extensible shape), but the stub could be even simpler (`useState` only) without any loss of test coverage in this milestone. Not blocking.

### Note — Task 9 deletes `App.tsx`

Currently `src/App.tsx` exists with a trivial `return <div />` and is referenced only from `main.tsx`. Task 9 correctly identifies this and deletes the file after rewiring `main.tsx`. Good cleanup. Make sure the `import App from './App.tsx'` line is removed from `main.tsx` in the same commit — it is implied but worth being explicit.

## Positive Notes

- Phase ordering is correct: providers/guards first (Tasks 1–2) → page shells (Tasks 3–7) → router/entry wiring (Tasks 8–9) → verification (Task 10). Each task can be unit-verified independently.
- The plan explicitly states it is a stub and where each shell will be filled in (Phase 2 milestones), preventing scope creep.
- Dependency annotations (`depends on Task 1`, `depends on Tasks 2–7`) are accurate.
- `SessionsPage` correctly handles both `/sessions` and `/sessions/:id` as a single component using `useParams`, matching the roadmap's "selecting a session updates the URL … no page navigation" intent.
- Manual verification step (Task 10) covers both unauthenticated (redirect) and authenticated (token in localStorage) paths.
- Commit plan (3 commits) is reasonable and aligns with task phases.
- `@/` alias usage is mandated consistently and the prior milestone's setup is verified.

PLAN_REVIEW_PASS
