# Plan: Configure React Router and page shells

## Context
Wire up React Router v6 with all routes (public + protected), create stub page components, and wrap the app in `RouterProvider`, `QueryClientProvider`, and a minimal `AuthProvider` so subsequent milestones (auth, sessions, calibrations) can fill the shells in place.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Stub providers and shared components

- [x] **Task 1: Create minimal AuthContext stub**
  Files: `src/core/auth/AuthContext.tsx`
  Create `AuthProvider` and `useAuth()` hook. Context value for this milestone: `{ token: string | null }`. On mount, read `mind_auth_token` from `localStorage` once into `useState`. Subscribe to the `storage` event to update `token` when another tab/window writes the key. Export `AuthProvider` (children prop) and `useAuth()` (throws if used outside provider). This is intentionally a stub — the full context with `login`/`logout`/`pendingEmail` is built in Phase 2 ("Auth context + token management"). Keep the shape extensible so Phase 2 can add fields without breaking imports. **All `localStorage` access for `mind_auth_token` must live in this file** (per ARCHITECTURE.md dependency rules). No imports from `pages/` or `components/`.

- [x] **Task 2: Create ProtectedRoute component**
  Files: `src/components/ProtectedRoute.tsx`
  Implement per ARCHITECTURE.md example: read `token` from `useAuth()`. If `token` is null, return `<Navigate to="/login" replace />`. Otherwise render `children` (typed as `ReactNode`). Import `Navigate` from `react-router-dom`. Only imports from `core/auth` — no API calls, no `localStorage` reads.

### Phase 2: Page stubs

- [x] **Task 3: Create LoginPage stub** (depends on Task 1)
  Files: `src/pages/LoginPage/index.tsx`
  Export named `LoginPage` function component. Render a centered placeholder (`<div className="flex h-screen items-center justify-center">Login</div>`). No logic — full implementation lands in Phase 2 milestones "Login page: email OTP flow" and "Login page: Google Sign-In".

- [x] **Task 4: Create MagicLinkPage stub**
  Files: `src/pages/MagicLinkPage/index.tsx`
  Export named `MagicLinkPage`. Render a centered "Verifying magic link…" placeholder. Full implementation lands in Phase 2 "Magic link auto-login".

- [x] **Task 5: Create GoogleCallbackPage stub**
  Files: `src/pages/GoogleCallbackPage/index.tsx`
  Export named `GoogleCallbackPage`. Render a centered "Completing Google sign-in…" placeholder. Full implementation lands in Phase 2 "Login page: Google Sign-In".

- [x] **Task 6: Create SessionsPage stub**
  Files: `src/pages/SessionsPage/index.tsx`
  Export named `SessionsPage`. Use `useParams<{ id?: string }>()` to read the optional `id` segment. Render a placeholder showing either "Sessions" or `Session: {id}` depending on whether `id` is set. This single component serves both `/sessions` and `/sessions/:id` (per milestone spec). Full implementation in Phase 3.

- [x] **Task 7: Create CalibrationPage stub**
  Files: `src/pages/CalibrationPage/index.tsx`
  Export named `CalibrationPage`. Render a centered "Calibrations" placeholder. Full implementation in Phase 4.

### Phase 3: Router and entry-point wiring

- [x] **Task 8: Create router configuration** (depends on Tasks 2–7)
  Files: `src/router.tsx`
  Export a `router` constant created via `createBrowserRouter` from `react-router-dom`. Routes in order:
  - `/` → `<Navigate to="/sessions" replace />`
  - `/login` → `<LoginPage />` (public)
  - `/deeplink-auth` → `<MagicLinkPage />` (public)
  - `/auth/google/callback` → `<GoogleCallbackPage />` (public)
  - `/sessions` → `<ProtectedRoute><SessionsPage /></ProtectedRoute>`
  - `/sessions/:id` → `<ProtectedRoute><SessionsPage /></ProtectedRoute>` (same component, `useParams` reads `id`)
  - `/calibrations` → `<ProtectedRoute><CalibrationPage /></ProtectedRoute>`
  Use the `@/` path alias for all imports (alias already configured in `vite.config.ts` and `tsconfig.app.json` per the previous milestone). Do not add a catch-all `*` route in this milestone — the milestone scope is the listed routes only.

- [x] **Task 9: Wire providers into main.tsx** (depends on Tasks 1, 8)
  Files: `src/main.tsx`, `src/App.tsx`
  Replace the existing `<App />` render with the provider stack. Order from outside in: `StrictMode` → `QueryClientProvider` (instantiate a single module-scope `const queryClient = new QueryClient()`) → `AuthProvider` → `RouterProvider router={router}`. Import `router` from `@/router`, `AuthProvider` from `@/core/auth/AuthContext`, `QueryClient`/`QueryClientProvider` from `@tanstack/react-query`. Keep the `./index.css` import. Delete `src/App.tsx` since it is no longer referenced (the milestone calls for the router to be the root render target).

- [x] **Task 10: Manual verification** (depends on Task 9)
  Files: _(no code changes)_
  Run `npm run typecheck` and `npm run lint` to confirm the wiring compiles cleanly. Start `npm run dev` and verify each URL renders its stub: `/` redirects to `/sessions` (which redirects to `/login` because no token is present), `/login`, `/deeplink-auth`, `/auth/google/callback` render their public stubs; with a value manually set in `localStorage` under `mind_auth_token`, `/sessions`, `/sessions/1`, and `/calibrations` render their protected stubs. No console errors.

## Commit Plan
- **Commit 1** (after tasks 1–2): Add AuthContext stub and ProtectedRoute
- **Commit 2** (after tasks 3–7): Add page shells for login, magic link, Google callback, sessions and calibrations
- **Commit 3** (after tasks 8–10): Wire React Router and provider stack into the app entry point
