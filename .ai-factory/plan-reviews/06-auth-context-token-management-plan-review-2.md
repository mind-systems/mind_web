# Plan Review: Auth context + token management (round 2)

**Plan:** `06-auth-context-token-management.md`
**Risk Level:** 🟢 Low

## Context Gates

- **ARCHITECTURE.md:** ✅ Plan preserves the "`core/auth/AuthContext.tsx` is the sole owner of `mind_auth_token` and `mind_pending_email` in `localStorage`" boundary. Importing `useNavigate` from `react-router-dom` is a third-party import and does not violate the `core/auth` dependency rule ("no imports from other `src/` folders"). The new `AuthLayout` defined inline in `src/router.tsx` keeps the provider tree colocated with router config, consistent with the existing `main.tsx → RouterProvider → QueryClientProvider → AuthProvider` model documented at line 45 of ARCHITECTURE.md (note: the ARCHITECTURE diagram still says `main.tsx` mounts `AuthProvider` — after this milestone that line is stale and should be updated in a follow-up edit, see S3 below). Non-blocking.
- **RULES.md (`.ai-factory/rules/base.md`):** ✅ `mind_auth_token` key preserved (rule on line 41 honored). `mind_pending_email` is a new key but does not conflict with any existing rule. Module structure in Task files (`src/main.tsx`, `src/router.tsx`, `src/core/auth/AuthContext.tsx`) matches the declared layout. No `console.*` introduced — matches the "no console.log in production code" rule.
- **ROADMAP.md:** ✅ Aligns exactly with Phase 2 milestone — context value shape, navigation on login/logout, `ProtectedRoute` reading `useAuth().token`, and acceptance condition "useAuth().logout() from a protected page redirects to `/login`" are all covered.

## Resolution of round-1 findings

- **Critical #1 (router restructuring promoted to first-class task):** ✅ Resolved. Task 1 explicitly restructures `main.tsx` and `router.tsx` with a `AuthLayout` root layout route, code example included, and acceptance criterion.
- **Critical #2 (null propagation in storage handler):** ✅ Resolved. Task 2 explicitly forbids a truthiness guard and documents *why* (`null` is the cross-tab `removeItem` signal). Code snippet matches.
- **S1 (stable callback identities + memo deps):** ✅ Resolved. `useMemo` deps `[token, pendingEmail, login, logout, setPendingEmail, clearPendingEmail]` and `useCallback` deps (`[navigate]` or `[]`) are pinned down in Tasks 2–4.
- **S2 (exported type name):** ✅ Resolved. Task 2 explicitly exports `interface AuthContextValue` replacing the existing one.
- **S3 (one-line comment on `login()` and `pendingEmail`):** ✅ Resolved. Task 3 inlines the exact comment.
- **S4 (logging guidance):** ✅ Resolved. Settings says "Logging: none" with explicit rationale.
- **S5 (acceptance check for verify task):** ✅ Resolved. Task 5 has a concrete smoke test (URL change, `localStorage` token cleared, `mind_pending_email` unchanged).

## Critical Issues

None.

## Suggestions (Non-blocking)

### S1. Task 5 smoke-test snippet has a hooks-rules bug

The task suggests:
```tsx
<button onClick={() => useAuth().logout()}>logout</button>
```
Calling `useAuth()` inside an `onClick` handler violates the Rules of Hooks — hooks must be called at component top level. The implementer will trip on this if they paste verbatim. Either:
- rewrite to `const { logout } = useAuth(); <button onClick={logout}>logout</button>`, **or**
- drop the snippet and rely on the "trigger `logout()` via React DevTools" alternative the task already mentions.

Non-blocking because the task offers DevTools as an equivalent path, but worth a one-line fix.

### S2. `useCallback` for `login`/`logout` deps — also reference setters

Task 3 says "Wrap both in `useCallback` with deps `[navigate]` only". Strictly correct (setters from `useState` are stable and don't need to be in deps), but ESLint's `react-hooks/exhaustive-deps` will flag `setToken` (and any `localStorage` write doesn't enter deps either, so that's fine). The plan should either:
- explicitly say `// eslint-disable-next-line react-hooks/exhaustive-deps` is NOT expected (setters are exempt by the rule itself, so the lint rule passes), **or**
- pre-empt confusion by noting "`setToken` need not be in deps; `react-hooks/exhaustive-deps` recognizes `useState` setters as stable".

Non-blocking — most engineers know this — but it heads off a back-and-forth.

### S3. ARCHITECTURE.md folder-structure annotation will become stale

After Task 1, `src/main.tsx` line annotation in ARCHITECTURE.md ("entry point: RouterProvider + QueryClientProvider + AuthProvider", line 45) is misleading because `AuthProvider` now lives inside the router. Consider a follow-up doc edit (or a one-line note added to this plan's "Notes" section asking the implementer to update that annotation while editing). Out of scope for this milestone if treated as a doc-debt item.

### S4. `react-refresh/only-export-components` may warn on the new `AuthLayout` in `router.tsx`

`src/router.tsx` exports `router` (a non-component). Adding `function AuthLayout()` inside the same file creates a mixed-export file, which the `react-refresh/only-export-components` rule flags. The existing codebase already disables this rule inline where needed (see `AuthContext.tsx` line 30). The plan should anticipate this and either:
- define `AuthLayout` in a separate file (`src/router/AuthLayout.tsx` or `src/core/auth/AuthLayout.tsx`), **or**
- add an `// eslint-disable-next-line react-refresh/only-export-components` above the `AuthLayout` declaration (or above `router`).

Non-blocking — the lint warning is not a hard error, and tests/build will still pass.

### S5. Lingering `mind_pending_email` after logout — intentional, but document the lifecycle

Plan correctly states `logout()` does not clear `pendingEmail` (only the magic-link flow calls `clearPendingEmail()`). That leaves a stale `mind_pending_email` in `localStorage` if a user starts the OTP flow then never completes it and never logs in. This is fine behaviorally (the next OTP attempt overwrites it; magic-link verify clears it). Worth a one-liner in Notes explicitly listing the lifecycle: "`pendingEmail` is set by `LoginPage` step 1, cleared by `MagicLinkPage` after successful verify; never cleared by `login()` or `logout()`." This pre-empts a future "why isn't logout clearing this?" question.

## Positive Notes

- Round-1 critical issues are fully resolved with concrete code snippets, not hand-wavy guidance.
- Task 1 includes a precise router shape (`createBrowserRouter([...])` example with `element: <AuthLayout />` and `children: [...]`) — minimal ambiguity for the implementer.
- Storage event handler explicitly disables the `if (event.newValue)` guard with rationale — exactly what round 1 asked for.
- Dependency arrays for both `useMemo` and `useCallback` are pinned down — avoids the subtle re-render-loop trap.
- Acceptance criteria are concrete: URL change, `localStorage.getItem('mind_auth_token') === null`, `localStorage.getItem('mind_pending_email')` unchanged.
- Task graph (1 → {2, 3, 4} → 5) is correct; dependencies are explicit.
- Notes section preserves the architectural rule "only `AuthContext.tsx` and `core/api/client.ts` may touch these two keys" — consistent with ARCHITECTURE.md.

## Verdict

All round-1 critical issues are resolved. The five non-blocking suggestions above are polish — a small Rules-of-Hooks bug in a smoke-test snippet (S1), two lint-friendliness notes (S2, S4), a doc-debt heads-up (S3), and an optional lifecycle documentation tweak (S5). None of these prevent the plan from being executed correctly by a careful implementer.

PLAN_REVIEW_PASS
