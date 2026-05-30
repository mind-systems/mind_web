# Plan Review: Auth context + token management

**Plan:** `06-auth-context-token-management.md`
**Risk Level:** 🟡 Medium

## Context Gates

- **ARCHITECTURE.md:** ✅ Plan respects boundary rules. `core/auth/AuthContext.tsx` remains the only owner of `mind_auth_token` and `mind_pending_email` in `localStorage`. Importing `useNavigate` from `react-router-dom` does not violate the "no imports from other `src/` folders" rule (third-party only).
- **RULES.md (`.ai-factory/rules/base.md`):** ✅ Token key `mind_auth_token` preserved. `pendingEmail` key `mind_pending_email` matches the roadmap convention.
- **ROADMAP.md:** ✅ Aligns with Phase 2 milestone — context value shape `{ token, login, logout, pendingEmail, setPendingEmail, clearPendingEmail }`, navigation behavior on `login`/`logout`, and `ProtectedRoute` reading `useAuth().token` are exactly as specified.

## Critical Issues

### 1. Router restructuring is mandatory but hedged into a Notes paragraph

The plan correctly identifies that `useNavigate()` will throw because `AuthProvider` currently wraps `RouterProvider` from the outside in `src/main.tsx` (lines 14–16):

```tsx
<AuthProvider>
  <RouterProvider router={router} />
</AuthProvider>
```

However, the fix is buried under "Notes" with hedging language ("Implementer should perform this restructuring as part of Task 2 **if it is the only way** to keep `useNavigate` available; otherwise an alternative is..."). It IS the only way under the stated approach — `useNavigate()` requires a `Router` ancestor, full stop. This needs to be promoted to an explicit task with concrete steps:

**Required additions:**

- **New explicit task** (or expansion of Task 2) covering both files:
  - `src/main.tsx`: remove `<AuthProvider>…</AuthProvider>` around `<RouterProvider />`. Leave `<QueryClientProvider>` in place.
  - `src/router.tsx`: introduce a root layout route whose `element` is an `AuthLayout` (or inline) component that renders `<AuthProvider><Outlet /></AuthProvider>`. Nest all existing routes (`/`, `/login`, `/deeplink-auth`, `/auth/google/callback`, `/sessions`, `/sessions/:id`, `/calibrations`) as children of that layout. The `/` redirect (`<Navigate to="/sessions" replace />`) and all current top-level routes need to become `children: [...]` of the new root layout.

Without an explicit task and file list, an implementer reading the plan top-down may skip the Notes section and produce code that throws on first render.

### 2. Storage event handler — explicit null handling for `pendingEmail`

Task 1 says "extend the listener to also sync `pendingEmail` when `event.key === PENDING_EMAIL_KEY`" but does not state what to do with `event.newValue` (which is `null` when another tab calls `removeItem`). For correctness on cross-tab logout/clear, the handler must accept `null` and clear state:

```ts
if (event.key === PENDING_EMAIL_KEY) {
  setPendingEmail(event.newValue);
}
```

Mention this explicitly so the implementer doesn't add an `if (event.newValue)` guard that breaks cross-tab clearing.

## Suggestions (Non-blocking)

### S1. Stable callback identities + memo dependency list

Task 1 says "Memoize the context value with `useMemo`" and Tasks 2/3 say "Wrap in `useCallback`". Make explicit that the `useMemo` deps array should be `[token, pendingEmail, login, logout, setPendingEmail, clearPendingEmail]`, and that the `useCallback` for `login`/`logout` should depend only on `navigate` (which is itself stable). This avoids subtle re-render loops in downstream `useEffect` consumers — the plan flags the goal in Notes but doesn't pin down the dep arrays.

### S2. Exported type name

The plan defines the value shape inline. Recommend explicitly exporting `interface AuthContextValue` (replacing the existing one) so consumers can type props/hooks. Minor — current code already exports it.

### S3. `login()` and `pendingEmail`

Plan correctly states that `login()` should NOT clear `pendingEmail` (caller-managed per the magic-link flow). Worth a one-line code comment in the implementation so a future maintainer doesn't "fix" it.

### S4. Settings says "Logging: minimal" but plan gives no logging guidance

Resolve by either: (a) adding a clause to Task 2 — "no console output, errors surfaced via thrown `ApiError` from API layer (out of scope here)" — or (b) dropping the Settings field. Currently the implementer has to guess.

### S5. Acceptance check for Task 4

Task 4 says "no code change is expected" but provides no concrete verification step. Suggest: "Manual smoke: from `/sessions`, call `useAuth().logout()` via a temporary button or React DevTools — confirm redirect to `/login` and `localStorage` cleared." This satisfies the milestone's acceptance condition explicitly.

## Positive Notes

- Correctly identifies the `useNavigate`-outside-`Router` trap (even if hedged) — many plans miss this.
- Preserves the existing `mind_auth_token` key and `storage` event listener pattern from the current stub.
- Module-level constants `TOKEN_KEY` / `PENDING_EMAIL_KEY` are good — single source of truth.
- Lazy initializer in `useState` (`() => localStorage.getItem(...)`) is the right pattern — avoids reading storage on every render.
- Architectural rule "only this file may read/write these two keys" is reaffirmed in Notes — matches `ARCHITECTURE.md` and `rules/base.md`.
- Task dependencies are explicit and correct (Task 2 and 3 depend on Task 1; Task 4 on Task 2).

## Verdict

The plan has the right intent and correctly diagnoses the `useNavigate` trap, but the router restructuring — which is a hard prerequisite for Task 2 to compile-and-run — must be a first-class task rather than an optional aside. Address Critical Issues #1 and #2; the rest are polish.