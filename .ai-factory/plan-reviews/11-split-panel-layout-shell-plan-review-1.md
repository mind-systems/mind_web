# Plan Review: Split-panel layout shell

**Plan:** `11-split-panel-layout-shell.md`
**Files Reviewed:** 1 plan + target source (`SessionsPage/index.tsx`, `AuthContext.tsx`, `LoginPage/index.tsx`, `router.tsx`)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Aligned. ARCHITECTURE.md explicitly describes `SessionsPage/index.tsx` as the "split-panel host: session list (left) + charts panel (right)" and lists `BiometricCharts.tsx` / `InstructionTimeline.tsx` as future sub-components. The plan correctly defers those (Note in plan), keeps `localStorage`/token access out of the page (uses `useAuth()` only), and makes no `apiFetch` calls — matching dependency rules "Pages must not read `localStorage` directly" and "single fetch point".
- **Rules (`.ai-factory/rules/`):** ✅ No violations. Tailwind-only styling (no custom CSS), PascalCase component, no `console.log`, no direct `localStorage` access. Logout via `useAuth()` matches the "Auth is a context" principle.
- **Roadmap (`.ai-factory/ROADMAP.md`):** ✅ Linked. Maps directly to the Phase 3 milestone "Split-panel layout shell" (line 29). Plan honors every spec point: two-column layout, ~280px left column, `flex h-screen overflow-hidden`, independent scroll on both columns, "Sessions" title + logout button, and "Select a session" empty state.

## Critical Issues

None.

## Observations (non-blocking)

1. **Codebase assumptions verified correct.** `useParams<{ id?: string }>()` is already wired in the current `SessionsPage` (line 4), `useAuth().logout()` exists in `AuthContext` (line 48–52) and already clears the token and navigates to `/login`, so the plan's claim "no extra navigation is needed" is accurate. The `@/core/auth/AuthContext` import path and `useAuth` usage mirror `LoginPage` exactly.

2. **Right-panel `id`-present branch is forward-looking but harmless.** The ROADMAP milestone scopes this shell to the empty state only; the plan additionally adds a `{/* session charts — next milestone */}` placeholder for the `id`-present branch. This is a reasonable preparation for the next milestone and introduces no behavior, but note the selected-session route (`/sessions/:id`) will render an effectively blank right panel until the charts milestone lands. Consider keeping the empty state as the fallback for `id`-present too, or this is acceptable as-is since it's a structural stub.

3. **Empty-state height.** The empty-state wrapper `flex h-full items-center justify-center` relies on the right panel (`flex-1 overflow-y-auto`) receiving a resolved height from the `h-screen` root flex container. This chain is valid (flex item stretches to the `h-screen` parent), so centering will work.

4. **Single-file + single-commit scope** is consistent with the architecture (sub-components introduced in later milestones) and the project's commit-message conventions. Commit message "Add split-panel layout shell to SessionsPage" follows the no-type-prefix, sentence-case rule.

## Positive Notes

- Accurate, specific Tailwind class guidance that matches the existing `LoginPage` gray/blue palette.
- Correctly defers `SessionList` / `BiometricCharts` creation, avoiding premature component extraction.
- Explicitly reinforces the architectural boundary (no `localStorage`, no `apiFetch` in the page).
- Each task names the exact file and is independently verifiable.

PLAN_REVIEW_PASS
