# Code Review: 05 — Configure React Router and page shells

## Scope

Reviewed all changes in `git status`:

- `src/core/auth/AuthContext.tsx` (new)
- `src/components/ProtectedRoute.tsx` (new)
- `src/pages/{LoginPage,MagicLinkPage,GoogleCallbackPage,SessionsPage,CalibrationPage}/index.tsx` (new)
- `src/router.tsx` (new)
- `src/main.tsx` (modified — provider stack + entry rewire)
- `src/App.tsx` (deleted — confirmed no remaining references)
- `.ai-factory/plans/05-configure-react-router-and-page-shells.{md,json}` (plan artefacts)
- `.ai-factory/plan-reviews/05-configure-react-router-and-page-shells-plan-review-1.md` (plan review artefact)

## Verification

- `npm run typecheck` → clean (no errors)
- `npm run lint` → clean (no warnings)
- Verified `App.tsx` removal is safe: `grep` for `App` import shows the old `import App from './App.tsx'` was removed from `src/main.tsx` in the same change, and there are no other consumers.
- Verified `@/` alias works: `tsconfig.app.json` has `paths: { "@/*": ["src/*"] }` and `vite.config.ts` has matching `resolve.alias` for `@`. All router imports use `@/…` consistently.
- Verified `react-router-dom@^7.16.0` supports `createBrowserRouter`, `RouterProvider`, `Navigate`, `useParams` (identical surface to v6 for the usage here).

## Findings

### AuthContext.tsx
- Initial state correctly reads from `localStorage` via lazy `useState` initializer — runs once per mount, not per render.
- `storage` event listener is cleaned up properly on unmount; StrictMode's double-mount in dev is handled.
- Note (non-blocking): the `storage` event only fires in *other* tabs, so manual verification via DevTools `localStorage.setItem` in the same tab will NOT trigger a re-render — Task 10 reviewers should set the token and reload, not expect live update. This matches the milestone requirements and will be replaced wholesale by Phase 2's `Auth context + token management`.
- The `eslint-disable react-refresh/only-export-components` on `useAuth` is the standard escape hatch for the "provider + hook in one file" pattern and is acceptable here.
- `localStorage` access is correctly confined to this file (per ARCHITECTURE.md rule).
- `useAuth` throws when used outside `AuthProvider` — good defensive default.

### ProtectedRoute.tsx
- Correct `import type { ReactNode }` (required by `verbatimModuleSyntax: true`).
- Renders `<Navigate to="/login" replace />` to avoid leaving the protected URL in browser history — correct.
- Only imports from `core/auth` and `react-router-dom`; no API calls, no `localStorage` reads.

### router.tsx
- All seven routes from the milestone spec are present in the correct order and with the correct public/protected split.
- Root `/` is a public redirect to `/sessions`, which is itself protected — so unauthenticated users at `/` get a two-step redirect `/` → `/sessions` → `/login`. This is the intended behaviour per the milestone and Task 10.
- No catch-all `*` route — consistent with the plan (explicitly out of scope).
- `Navigate` is imported alongside `createBrowserRouter` from `react-router-dom`, not duplicated from elsewhere.

### main.tsx
- Provider order is `StrictMode → QueryClientProvider → AuthProvider → RouterProvider` — outside-in matches the plan and standard React Router v6/v7 + TanStack Query layering.
- `queryClient` is module-scope (one instance for the app lifetime), avoiding the common pitfall of creating it inside the component (which would reset cache on every re-render).
- No default `QueryClient` options are supplied; defaults are fine for stubs (no queries are issued yet).
- Trailing semicolons and import style are consistent with the rest of the new code.

### Page stubs
- Each page exports a named function component matching the plan (`LoginPage`, `MagicLinkPage`, `GoogleCallbackPage`, `SessionsPage`, `CalibrationPage`).
- `SessionsPage` uses `useParams<{ id?: string }>()` and conditionally renders `Session: {id}` vs. `Sessions`, satisfying the shared-component requirement for `/sessions` and `/sessions/:id`.
- All stubs use the Tailwind `flex h-screen items-center justify-center` placeholder — consistent, side-effect-free, and matches the plan's example markup.

## Runtime concerns

- No race conditions: `AuthProvider` token state is initialized synchronously from `localStorage` before any consumer reads it, so the first paint of `ProtectedRoute` will correctly redirect when no token is present.
- No type mismatches: full `tsc --noEmit` passes.
- No missing migrations / DB / network changes (this milestone is pure UI scaffolding).
- No cross-page imports; no fetch-in-components violations (no fetches at all yet).

## Architectural compliance

- ✅ `core/auth` imports nothing from other `src/` folders.
- ✅ `components/ProtectedRoute` imports from `core/auth` only — matches ARCHITECTURE.md's own example (which itself supersedes the rule's literal "core/types only" wording for the auth-guard case).
- ✅ `localStorage` access is confined to `core/auth/AuthContext.tsx`.
- ✅ Pages do not read `localStorage` or call `apiFetch`.
- ✅ `mind_auth_token` key preserved.
- ✅ All files in English.

REVIEW_PASS
