# Code Review: Split-panel layout shell

**Milestone:** 11 — Split-panel layout shell
**Files changed:** `src/pages/SessionsPage/index.tsx` (only source file; the rest are plan/metadata artifacts)
**Risk Level:** 🟢 Low

## Scope

`git diff HEAD` / `git status` show one source change: `src/pages/SessionsPage/index.tsx` rewritten from a centered placeholder into a two-column split-panel shell. The other staged files are planning artifacts (`.ai-factory/plans/*`, `plan-reviews/*`) with no runtime impact.

## Correctness

- **Layout matches spec.** Root `flex h-screen overflow-hidden`; left column `w-[280px] shrink-0 flex flex-col border-r`; right panel `flex-1 overflow-y-auto`. Both columns scroll independently — the left column's header is pinned (`border-b` row) and only the `flex-1 overflow-y-auto` region below it scrolls; the right panel scrolls as a whole. Correct.
- **Empty-state centering chain is valid.** `flex h-full items-center justify-center` resolves because the right panel is a `flex-1` child of the `h-screen` flex root, so `h-full` has a concrete parent height to resolve against. Centering will render correctly.
- **`useParams` branch.** `id` absent → "Select a session" empty state; `id` present → empty placeholder div. As noted in the plan, `/sessions/:id` renders a visually blank right panel until the charts milestone lands. This is an intentional forward-looking stub, not a bug.
- **`useAuth()` is safe here.** `SessionsPage` is rendered under `ProtectedRoute` inside `AuthLayout`, which wraps `<Outlet/>` in `<AuthProvider>` (router.tsx). So the `useAuth()` context is guaranteed present — no "must be used within an AuthProvider" throw.
- **Logout wiring.** `onClick={logout}` calls `AuthContext.logout()`, which clears the token and navigates to `/login`. Passing the function reference directly is fine — the synthetic click event is ignored by `logout()`. No extra navigation needed, as the plan states.

## Security
- No `localStorage`, no `apiFetch`, no token handling in the page — matches the architecture boundary (auth via `useAuth()` only). No issues.

## Style / Conventions
- Tailwind-only, gray/blue palette consistent with `LoginPage`. PascalCase component, English copy, no `console.*`. `w-[280px]` arbitrary value is valid in the pinned Tailwind v3 setup.

## Findings
None blocking. The single observation — a blank right panel on `/sessions/:id` — is an expected interim state explicitly scoped to the next milestone, not a defect.

REVIEW_PASS
