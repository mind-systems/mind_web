# Code Review: Magic link auto-login

**Plan:** `08-magic-link-auto-login.md`
**Changed files reviewed:** `src/pages/MagicLinkPage/index.tsx` (the only code change; the rest of the diff is plan/metadata files)
**Verification:** `npm run typecheck` ✅ clean · `npm run lint` ✅ clean

## Summary

The implementation matches the plan and the roadmap behavior precisely, respects the architecture's dependency rules (imports only from `core/api`, `core/auth`, `core/types`; no raw `fetch`; no direct `localStorage` access), and reuses `LoginPage`'s card/spinner/error conventions. No bugs, security issues, or correctness problems found.

## Correctness analysis

- **Initial status derivation** (lines 14–18) is computed synchronously from `code` and `auth.pendingEmail`. Since `pendingEmail` is hydrated from `localStorage` during `AuthProvider` init, it is reliably available on first render — no flash/race. Correct three-way branch: no code → `error`; code + pendingEmail → `verifying`; code only → `need-email`.
- **Single-use code guard** (lines 37–47): the `didVerify` `useRef` latch correctly prevents a double `verify-code` call under React 18 StrictMode dev double-invoke (the ref persists across the setup→cleanup→setup cycle on the same fiber). Since the OTP is single-use, this is the right mechanism — a bare effect dependency array would not have sufficed. Matches the plan-review recommendation.
- **Login ordering** (lines 31–32): `clearPendingEmail()` is called before `login()`, exactly as required by the notes (since `AuthContext.login()` intentionally does not clear `pendingEmail` and navigates to `/sessions`).
- **Shared helper**: the `verify(email, code)` callback is used by both the auto path and the form submit, eliminating duplication as the plan specified. The auto path passes `auth.pendingEmail`; the form passes the trimmed `emailInput`.
- **Error handling** mirrors `LoginPage`: `err instanceof ApiError ? err.message : 'Something went wrong'`, with an inline red message in `need-email` and a dedicated error card with a "Back to sign in" link when `code` is absent.
- **API shape** (lines 27–29) matches `LoginPage` and `AuthResponse` (`{ accessToken, user }`); `res.accessToken` is used correctly.

## Non-blocking observations

These are awareness notes, not defects — no action required for this milestone:

1. **`setLoading(false)` after navigation** (line 59): on a successful form submit, `verify()` triggers `login()` → `navigate('/sessions')`, then the `finally` runs `setLoading(false)`. React Router v6 does not unmount synchronously, so this sets state on a still-mounted component — harmless, no warning. Noted only for completeness.
2. **Already-authenticated user**: `/deeplink-auth` is public (no `ProtectedRoute`); a user with a valid token who opens a magic link will still attempt verification. Worst case is a benign error state. Optional short-circuit to `/sessions` was already flagged as optional polish in the plan review and is out of scope here.
3. **OTP in URL/history**: the `?code=` lands in browser history; this is inherent to the existing email-template design and out of scope for this frontend task. `login()` already uses `navigate(..., { replace: true })`, so the successful landing does not stack on history.

## Conclusion

The code is correct, type-safe, lint-clean, architecturally compliant, and faithful to the plan. No findings.

REVIEW_PASS
