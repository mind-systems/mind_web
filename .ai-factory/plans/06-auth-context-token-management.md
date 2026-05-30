# Plan: Auth context + token management

## Context
Extend the existing `AuthContext` stub into a full auth state holder that owns both the JWT token (`mind_auth_token`) and the email pending OTP verification (`mind_pending_email`) in `localStorage`, exposes `login`/`logout`/`setPendingEmail`/`clearPendingEmail`, and triggers router navigation on auth transitions so `ProtectedRoute` redirects to `/login` after `logout()`.

Because `useNavigate()` requires a `Router` ancestor, `AuthProvider` must be relocated **inside** `RouterProvider`. The current `src/main.tsx` wraps `RouterProvider` with `AuthProvider` from the outside, so this milestone also restructures the router into a root layout route that hosts `AuthProvider`.

## Settings
- Testing: no
- Logging: none (no `console.*` calls; auth errors are surfaced by the API layer, out of scope here)
- Docs: no

## Tasks

### Phase 1: Restructure provider tree so `useNavigate` is available

- [x] **Task 1: Move `AuthProvider` from `main.tsx` into a router root layout**
  Files: `src/main.tsx`, `src/router.tsx`
  In `src/main.tsx`: remove the `<AuthProvider>…</AuthProvider>` wrapper around `<RouterProvider router={router} />`. Leave `<QueryClientProvider>` and `<StrictMode>` in place. Remove the now-unused `AuthProvider` import.
  In `src/router.tsx`: introduce a root layout route whose `element` renders `<AuthProvider><Outlet /></AuthProvider>` (import `Outlet` from `react-router-dom` and `AuthProvider` from `@/core/auth/AuthContext`). The layout component can be defined inline at the top of `router.tsx` — e.g. `function AuthLayout() { return <AuthProvider><Outlet /></AuthProvider>; }`. Convert the existing seven top-level routes (`/`, `/login`, `/deeplink-auth`, `/auth/google/callback`, `/sessions`, `/sessions/:id`, `/calibrations`) into `children` of this new root entry so the full router shape becomes:
  ```ts
  createBrowserRouter([
    {
      element: <AuthLayout />,
      children: [
        { path: '/', element: <Navigate to="/sessions" replace /> },
        { path: '/login', element: <LoginPage /> },
        // …all other current routes…
      ],
    },
  ])
  ```
  Acceptance: `npm run dev` boots, every existing route still renders its current stub, and no `useNavigate` errors appear in the console.

### Phase 2: Implement AuthContext

- [x] **Task 2: Extend `AuthContext` value, storage, and cross-tab sync** (depends on Task 1)
  Files: `src/core/auth/AuthContext.tsx`
  Replace the current single-field context with the full value shape. Export it as `interface AuthContextValue { token: string | null; login(token: string): void; logout(): void; pendingEmail: string | null; setPendingEmail(email: string): void; clearPendingEmail(): void }` (replacing the existing interface).
  Define module-level constants `const TOKEN_KEY = 'mind_auth_token'` and `const PENDING_EMAIL_KEY = 'mind_pending_email'`. Initialize both `token` and `pendingEmail` with `useState` lazy initializers reading `localStorage.getItem(...)`.
  Extend the existing `storage` event listener so it handles **both** keys, and on each match calls the corresponding setter with `event.newValue` **without** any truthiness guard — `event.newValue` is `null` when another tab calls `removeItem`, and that `null` must propagate to state so cross-tab logout/clear works:
  ```ts
  const handler = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY) setToken(event.newValue);
    if (event.key === PENDING_EMAIL_KEY) setPendingEmail(event.newValue);
  };
  ```
  Memoize the context value with `useMemo` and pass exactly these deps: `[token, pendingEmail, login, logout, setPendingEmail, clearPendingEmail]`.

- [x] **Task 3: Implement `login` and `logout` with navigation** (depends on Task 2)
  Files: `src/core/auth/AuthContext.tsx`
  Inside `AuthProvider`, obtain `navigate` via `useNavigate()` from `react-router-dom`.
  Implement `login(token)`: write to `localStorage` under `TOKEN_KEY`, update `token` state, then call `navigate('/sessions', { replace: true })`. Add a one-line code comment: `// Do not clear pendingEmail here — magic-link flow clears it explicitly via clearPendingEmail().`
  Implement `logout()`: `localStorage.removeItem(TOKEN_KEY)`, set `token` state to `null`, then `navigate('/login', { replace: true })`.
  Wrap both in `useCallback` with deps `[navigate]` only (`navigate` from React Router v6 is a stable reference, so the resulting callbacks have stable identity).

- [x] **Task 4: Implement `setPendingEmail` and `clearPendingEmail`** (depends on Task 2)
  Files: `src/core/auth/AuthContext.tsx`
  `setPendingEmail(email)`: `localStorage.setItem(PENDING_EMAIL_KEY, email)` then update state. `clearPendingEmail()`: `localStorage.removeItem(PENDING_EMAIL_KEY)` then set state to `null`. Wrap both in `useCallback` with empty deps (they only call stable setters and `localStorage`). Include them in the `useMemo` value from Task 2.

### Phase 3: Verify behavior

- [x] **Task 5: Verify `ProtectedRoute` reacts to logout** (depends on Tasks 1, 3)
  Files: `src/components/ProtectedRoute.tsx` (read-only — no code change expected)
  The component already reads `useAuth().token` and renders `<Navigate to="/login" replace />` when null. Only adding fields to the context — `token` is not renamed — so it still compiles.
  Manual smoke verification: temporarily add a `<button onClick={() => useAuth().logout()}>logout</button>` inside `SessionsPage` (or trigger `logout()` via React DevTools), navigate to `/sessions`, click. Confirm that (a) the browser URL changes to `/login`, (b) `localStorage.getItem('mind_auth_token')` returns `null` afterwards, and (c) `localStorage.getItem('mind_pending_email')` is **unchanged** (logout does not clear it). Remove the temporary button before completing the task.

## Notes
- Do NOT read or write `mind_auth_token` or `mind_pending_email` from anywhere except `src/core/auth/AuthContext.tsx`. `core/api/client.ts` (created in a later milestone) is the only other location permitted to read `mind_auth_token`, per `ARCHITECTURE.md`.
- All callbacks use stable identities (deps confined to `navigate` or empty) so consumers using `useEffect` with auth dependencies don't loop.
- `login()` intentionally does NOT clear `pendingEmail` — the magic-link flow (Phase 2 roadmap, Task "Magic link auto-login") calls `clearPendingEmail()` itself after a successful verify, and a non-magic-link login should not touch the pending state.
- After Task 1, `AuthProvider` is part of the router tree. Any future provider that needs router hooks should be added inside the same `AuthLayout` element, not back in `main.tsx`.
