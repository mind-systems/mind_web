# Plan Review #2: Login page — email OTP flow

**Plan:** `07-login-page-email-otp-flow.md`
**Files Reviewed:** plan + `core/api/client.ts` (absent — `.gitkeep` only), `core/types/index.ts` (absent — `.gitkeep` only), `core/config.ts`, `core/auth/AuthContext.tsx`, `router.tsx`, `pages/LoginPage/index.tsx` (stub), `ARCHITECTURE.md`, `rules/base.md`, `ROADMAP.md`, `notes/01-api-contract-decisions.md`, and plan-review-1.
**Risk Level:** 🟢 Low — every Critical/WARN from review-1 is resolved; only cosmetic notes remain.

---

## Context Gates

- **Architecture (`ARCHITECTURE.md`)** — ✅ Aligned. Single fetch point in `core/api/client.ts`, page uses `useAuth()` and never touches `localStorage` directly, types in `core/types`. The plan now explicitly documents the two deliberate deviations from the skeleton (conditional 401, preserve server message) and explains *why* the verbatim skeleton is wrong here, so the deviation is intentional rather than accidental.
- **Rules (`rules/base.md`)** — ✅ The "401 → clear token + redirect" rule is now explicitly carved out (Notes → "Rule conflict to flag"). The carve-out ("redirect on 401 only when a token was actually present") is the correct reading: a logged-out user verifying an OTP has no token, so the failure falls through to the message-preserving branch. **WARN (advisory):** `rules/base.md` line 26 still states the unconditional rule. Not a blocker for this plan, but the rule text should eventually be updated to match this carve-out so a future implementer doesn't "fix" the deviation back into the bug.
- **Roadmap (`ROADMAP.md`)** — ✅ Matches the active Phase 2 milestone "Login page: email OTP flow". Google Sign-In and the full "API client with auth interceptor" milestone are correctly deferred; the plan acknowledges that standing up `apiFetch` early overlaps the later milestone and frames it as a minimal, forward-compatible seed (later milestone refines, not recreates).

---

## Resolution of Review-1 Findings

All five findings from plan-review-1 are addressed:

1. **Critical #1 (global 401 breaks invalid/expired-code path)** — ✅ Resolved. Task 2 deviation #1 specifies the conditional redirect (token-present only), and deviation #2 mandates carrying `body.message` instead of a hardcoded `'Unauthorized'`. Task 3 step 2 now correctly expects `'Invalid or expired code'` to surface inline. Task 2 and Task 3 are now internally consistent.
2. **WARN #2 (400 `message` is an array)** — ✅ Resolved. Task 2 specifies `Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed')`.
3. **WARN #3 (429 cooldown)** — ✅ Resolved. Task 3 step 1 and the Notes explicitly acknowledge the 429 "Too Many Requests" path surfacing through the inline error.
4. **WARN #4 (`pendingEmail` left stale)** — ✅ Resolved. Task 3 step 2 calls `auth.clearPendingEmail()` before `auth.login()`.
5. **LOW #5 (`locale`/`language` omitted)** — ✅ Resolved. Notes document the intentional deferral, consistent with the backend's `resolveLocale` default.

---

## Critical Issues

None.

---

## Non-Blocking Notes

### A. `client.ts` / `types/index.ts` do not exist yet (cosmetic) — LOW
The plan's Notes call these files "currently empty." They are actually absent — each directory holds only a `.gitkeep`. Task 1 and Task 2 create them, so there is no functional impact; the description is just slightly off. No action required.

### B. Logged-in user re-verifying on `/login` is an accepted edge — LOW
Because the redirect fires whenever a token was present, a user who is already authenticated, navigates to `/login`, and mistypes an OTP would be redirected (and token-cleared) on the 401 instead of seeing an inline error. This is a benign corner case — `/login` is public but a logged-in user has no normal reason to be there — and the chosen approach is still the right default for every protected page. Worth keeping in mind but not worth complicating the minimal client. No change needed.

### C. `window.location.assign('/login')` is a full reload — LOW (by design)
Consistent with the architecture skeleton and the "minimal, forward-compatible" intent. The later API-client milestone can switch to router-based navigation. Acceptable for this scope.

---

## Positive Notes

- **Contract verified end-to-end.** `POST /auth/send-code` → `{ message }` (response unused, fine) and `POST /auth/verify-code` → `{ accessToken, user }` match `notes/01-api-contract-decisions.md`. The minimal `User` (`id`, `email`) is a safe subset of the real DTO.
- **Auth integration is exact.** `useAuth()` exposes `login`, `setPendingEmail`, `clearPendingEmail`; `login()` already navigates to `/sessions`, and the plan correctly avoids duplicating navigation in the page.
- **Error-path reasoning is now first-class.** The plan derives the `apiFetch` design from the concrete backend error contract (401 wrong-code, 400 array message, 429 cooldown) rather than copying the skeleton blindly — this is exactly what review-1 asked for.
- **Paths and aliases check out.** `@/core/config` → `API_BASE_URL`, `src/pages/LoginPage/index.tsx`, and `core/types` placement are all valid against the live tree and `ARCHITECTURE.md`.

---

## Verdict

The revision resolves the one Critical issue and all WARNs from review-1. The 401 carve-out is correct and well-documented, message normalization is specified, `pendingEmail` cleanup is added, and roadmap/architecture alignment holds. Remaining notes are cosmetic. Ready for implementation.

PLAN_REVIEW_PASS
