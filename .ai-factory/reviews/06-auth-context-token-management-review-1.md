# Code Review: Auth context + token management

**Plan:** `.ai-factory/plans/06-auth-context-token-management.md`
**Files changed:**
- `src/core/auth/AuthContext.tsx` (modified)
- `src/main.tsx` (modified)
- `src/router.tsx` (modified)

**Static checks run locally:**
- `npm run typecheck` → ✅ passes (no TypeScript errors).
- `npx eslint --format json src/` → ⚠️ 1 warning (see Finding #1 below).
- `npm run build` → ❌ fails, **unrelated** to this change (local Node.js is v18.15.0; Vite requires ≥20.19). Not caused by this milestone.

## Verdict summary
The implementation matches the plan accurately. All five tasks are completed correctly: the provider tree has been restructured via an `AuthLayout` root route, `AuthContext` exposes the full six-field value, storage keys are owned exclusively by this module, the cross-tab `storage` listener propagates `null` correctly, and `useMemo` / `useCallback` dep arrays are pinned exactly as specified. The `ProtectedRoute` continues to work without change because the `token` field's shape is unchanged.

The findings below are minor and **non-blocking**.

## Findings

### 1. Lint warning: `react-refresh/only-export-components` in `src/router.tsx`

`src/router.tsx:10` triggers:

```
react-refresh/only-export-components — Fast refresh only works when a file only exports components.
```

Cause: the file now defines `function AuthLayout()` (a component) but also exports `router` (not a component). This is exactly the case round-2 plan review S4 anticipated. Behavioral impact: none — production build and HMR for non-component changes still work; only HMR for `AuthLayout` itself is degraded (full reload instead of fast refresh).

Mitigations (pick one):
- Add `// eslint-disable-next-line react-refresh/only-export-components` above `function AuthLayout()`.
- Extract `AuthLayout` to its own file, e.g. `src/core/auth/AuthLayout.tsx`, and import it from `router.tsx`.

The existing codebase already uses the inline disable pattern in `src/core/auth/AuthContext.tsx:72` for the same rule, so the disable-comment is the lower-touch fix.

### 2. Pre-existing `ARCHITECTURE.md` doc-debt is now stale (out of scope, but worth tracking)

`.ai-factory/ARCHITECTURE.md:45` still says:
> `main.tsx — entry point: RouterProvider + QueryClientProvider + AuthProvider`

After this change, `main.tsx` no longer mounts `AuthProvider` — the router does. Round-2 plan review S3 flagged this and the plan acknowledged it but did not include a doc update as a task. Not a code-correctness issue; flagging for follow-up only.

### 3. Hooks-Rules-violating snippet in plan (Task 5) was not pasted into source — good

Plan Task 5 included the snippet `<button onClick={() => useAuth().logout()}>logout</button>`, which would violate Rules of Hooks if pasted verbatim. Verified that the implementer did NOT add any temporary logout button to `SessionsPage` (still the 11-line stub from the earlier scaffold). No issue in code. Just noting the trap was avoided.

## Correctness analysis (per-file walkthrough)

### `src/core/auth/AuthContext.tsx`
- `useNavigate()` (line 27) is now safely available because `AuthProvider` is rendered inside `RouterProvider` via `AuthLayout` — verified by reading `router.tsx`.
- `useState` lazy initializers (lines 20–25) avoid re-reading `localStorage` on each render. Correct.
- `useEffect` storage handler (lines 29–36) propagates `event.newValue` without a truthiness guard, so cross-tab `removeItem` correctly clears state to `null`. Matches plan Task 2 explicitly.
- `login` (lines 38–46) writes token before navigating — important ordering: by the time `<Navigate>` / route render evaluates, state is already updating and `ProtectedRoute` will see the new token on the next render. Includes the required code comment about not clearing `pendingEmail`.
- `logout` (lines 48–52) is symmetric; clears token + state then navigates. `ProtectedRoute` will redirect even without the explicit `navigate('/login')` call (defense in depth), but the explicit call ensures immediate redirect even from non-protected routes.
- `setPendingEmail` / `clearPendingEmail` (lines 54–62) wrap stable setters and `localStorage` calls; empty deps are correct (React guarantees `useState` setters are stable, and `react-hooks/exhaustive-deps` exempts them — no lint suppression needed).
- `useMemo` deps (line 66) include all six value fields. Because every callback has stable identity, `value` only re-creates when `token` or `pendingEmail` actually change. Correct.
- Public surface: `AuthContextValue` interface and `useAuth` hook are exported; `AuthProvider` is exported. `useAuth` throws on missing provider — correct fail-loud pattern.

### `src/main.tsx`
- `AuthProvider` import removed (line 5 of the previous version) — no unused-import lint warning.
- Provider tree is now `StrictMode → QueryClientProvider → RouterProvider`. `AuthProvider` no longer wraps from outside — correct.

### `src/router.tsx`
- `AuthLayout` (lines 10–16) wraps `<Outlet />` with `<AuthProvider>`, making `AuthProvider` part of the router tree exactly as specified.
- `createBrowserRouter` (line 18) now has a single root entry whose `element` is `<AuthLayout />` and whose `children` are the seven previously top-level routes. The redirect `/` → `/sessions`, public routes (`/login`, `/deeplink-auth`, `/auth/google/callback`), and the three protected routes are all preserved with identical shapes.
- One small note on React Router v6 semantics: a layout route with no `path` matches every child route, and `AuthLayout` is NOT remounted when navigating between sibling children (React Router preserves it via `<Outlet />`). This means `AuthProvider` state survives navigation — which is what we want (token / `pendingEmail` shouldn't reset on every route change).

## Runtime / race-condition analysis
- **StrictMode double-invocation:** `useEffect` cleanup correctly removes the storage listener; only one listener active at a time. ✅
- **Cross-tab logout from a protected page:** tab B clears token → storage event → tab A's `setToken(null)` → `ProtectedRoute` re-renders → `<Navigate to="/login">`. No `useNavigate` call needed from the listener. ✅
- **`login()` race:** `setToken(tok)` and `navigate('/sessions')` are called synchronously in the same event. React batches them; the navigation completes and the next render finds `token` set, so `ProtectedRoute` lets `SessionsPage` render. ✅
- **`logout()` from a non-protected page:** rare but possible — the explicit `navigate('/login')` covers this case so the user lands on `/login` even when not behind `ProtectedRoute`. ✅
- **No XSS-localStorage concern introduced** — this project already accepted `localStorage` for the JWT token per `ARCHITECTURE.md`; the new `mind_pending_email` key is just an email address, no additional sensitivity.

## Plan compliance checklist
- [x] Constants `TOKEN_KEY = 'mind_auth_token'`, `PENDING_EMAIL_KEY = 'mind_pending_email'` defined at module scope.
- [x] `AuthContextValue` exported.
- [x] Lazy `useState` initializers for both `token` and `pendingEmail`.
- [x] Storage listener handles both keys and propagates `null` (no truthiness guard).
- [x] `login(token)` stores, updates state, navigates to `/sessions` with `replace: true`.
- [x] `login()` does NOT clear `pendingEmail`; comment present.
- [x] `logout()` removes, updates state, navigates to `/login` with `replace: true`.
- [x] `useCallback` deps: `[navigate]` for login/logout; `[]` for the pending-email helpers.
- [x] `useMemo` deps: all six fields included.
- [x] `AuthProvider` moved from `main.tsx` into `AuthLayout` root route in `router.tsx`.
- [x] All seven existing routes preserved as children of the new root.
- [x] `ProtectedRoute` unchanged and still compiles (token field is not renamed).
- [x] `npm run typecheck` clean.