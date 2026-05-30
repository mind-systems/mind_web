# Code Review: Auth context + token management (round 2)

**Plan:** `.ai-factory/plans/06-auth-context-token-management.md`
**Files changed since round 1:**
- `src/router.tsx` — added `// eslint-disable-next-line react-refresh/only-export-components` above `function AuthLayout()`.
- `.ai-factory/ARCHITECTURE.md` — updated the `main.tsx` annotation in the folder-structure diagram to reflect that `AuthProvider` now lives inside the router via `AuthLayout`.

(No changes to `src/core/auth/AuthContext.tsx` or `src/main.tsx` since round 1 — both already passed review.)

## Static checks
- `npm run typecheck` → ✅ passes (no TypeScript errors).
- `npx eslint --format json src/` → ✅ **0 messages** (the `react-refresh/only-export-components` warning flagged in round 1 is now suppressed exactly where it belongs).
- `npm run build` → still fails locally due to Node 18 vs Vite ≥20.19 mismatch — pre-existing, unrelated to this milestone.

## Resolution of round-1 findings
- **Finding #1 (lint warning in `src/router.tsx`):** ✅ Resolved. The `eslint-disable-next-line react-refresh/only-export-components` comment is placed immediately above `function AuthLayout()` (line 10), matching the existing project pattern at `src/core/auth/AuthContext.tsx:72`.
- **Finding #2 (stale `ARCHITECTURE.md:45` annotation):** ✅ Resolved. The folder-structure diagram now reads `main.tsx — entry point: RouterProvider + QueryClientProvider (AuthProvider is inside the router via AuthLayout)`.
- **Finding #3 (Hooks-Rules trap in plan Task 5 snippet):** ✅ Was informational only — implementer correctly did not paste the bad snippet into source. `SessionsPage` remains the 11-line stub. No code change needed or made.

## Plan compliance (unchanged from round 1)
All five tasks remain marked `[x]` and the implementation matches the plan: provider tree restructured via `AuthLayout`, six-field context value with stable callbacks and memoized value, exclusive ownership of `mind_auth_token` and `mind_pending_email` localStorage keys, cross-tab `storage` listener propagates `null`, `ProtectedRoute` untouched and still compiles.

## Conclusion
No remaining findings.

REVIEW_PASS
