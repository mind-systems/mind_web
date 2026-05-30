# Plan Review: Login page — Google Sign-In (Review 2)

**Plan:** `.ai-factory/plans/09-login-page-google-sign-in.md`
**Files Reviewed:** plan + LoginPage, MagicLinkPage, GoogleCallbackPage, router, config, api/client, AuthContext, types (mind_web); google-callback.controller, google-code-exchange.dto, `.env` (mind_api)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. All HTTP stays in `apiFetch`; the Google entry point is a deliberate full-page `window.location.href` navigation (not a `fetch`), which the plan calls out explicitly as a documented exception — acceptable. No `localStorage` in pages (token persistence delegated to `auth.login`). No `useQuery` added to shared components. Aligned.
- **Rules (`CLAUDE.md`):** PASS. English-only, `mind_auth_token` untouched, no raw `fetch` in pages (redirect is navigation), `localStorage` confined to `core/`. OK.
- **Roadmap (`ROADMAP.md`):** WARN. The plan matches the open item "Login page: Google Sign-In" (line 21). **However the ROADMAP line 21 description still encodes the stale relay-flow params (`googleCode`/`googleError`) and an outdated relay topology** — directly contradicting the now-corrected plan. The plan is right; the roadmap text is stale. Non-blocking for this implementation, but the ROADMAP line should be corrected to the direct-to-web `code`/`error` contract so future work doesn't re-derive the wrong assumption (this was also flagged in Review 1).
- **skill-context:** `.ai-factory/skill-context/aif-review/SKILL.md` absent — no project-specific overrides to apply.

## Resolution of Review 1 findings

- **Critical Issue 1 (wrong callback param names) — RESOLVED.** The plan now reads the **standard OAuth params `code`/`error`** (Task 3), matching what Google actually sends. Independently re-verified against `mind_api/src/users/controller/google-callback.controller.ts`:
  - `@Get('google')` → `startGoogleOAuth` sets `redirect_uri: WEB_REDIRECT_URI`, and `mind_api/.env` line 30 sets `WEB_REDIRECT_URI=http://localhost:5173/auth/google/callback` (the web origin). So Google redirects the browser **straight to the web app** with `?code=…` / `?error=…`.
  - The `googleCode`/`googleError` rewrite lives only in the `@Get('google/callback')` **relay** handler, which redirects to `APP_BASE_URL` (the mobile deeplink host) — not part of the web flow.
  - The plan's "Coupled contract — do not split" note correctly captures that the param names and the `redirectUri` value belong to one topology. ✅
- **Issue 2 (`redirectUri` value) — CONFIRMED CORRECT.** `@Post('google')` validates `dto.redirectUri === WEB_REDIRECT_URI` (controller line 72). `window.location.origin + '/auth/google/callback'` resolves to exactly `http://localhost:5173/auth/google/callback` in dev, which matches. The DTO also requires an `http(s)://` URL (`@Matches(/^https?:\/\//)`) — satisfied. ✅
- **Non-blocking notes from Review 1** (error-param overlap across routes, effect-not-render param clearing, AuthResponse type drift, StrictMode ref guard, 200 response shape, 401 non-interference, optional `language` omitted) — all correctly folded into the revised plan's task wording.

## Verification against codebase

- **Task 1:** `API_BASE_URL` is exported from `@/core/config` (confirmed). `loading` flag exists in `LoginPage` and gates the existing button — reusing it to disable the Google button is consistent. Button scoped to the `email` step is sound.
- **Task 2:** `useSearchParams` is already used in `MagicLinkPage`; the lazy-`useState` + one-shot effect pattern mirrors it correctly. `LoginPage`'s `error` state is `useState<string | null>(null)` — switching to a lazy initializer is a clean change, and `handleSendCode`/`handleVerifyCode` both call `setError(null)` first, so a later OTP submission cleanly overwrites the seeded `error=google` message.
- **Task 3:** `apiFetch`/`ApiError` (`@/core/api/client`), `useAuth` (`@/core/auth/AuthContext`), `AuthResponse` (`@/core/types`) all exist as referenced. `auth.login` persists the token and navigates to `/sessions` (AuthContext line 38–46) — matches the plan. The 401 auto-redirect in `client.ts` only fires when a token is present (`res.status === 401 && token`), so a failed exchange (no stored token) falls through to the plan's `catch → navigate('/login?error=google')`. ✅ Route `/auth/google/callback` is registered and public in `router.tsx`. ✅

## Non-blocking notes

- **`useNavigate` / `useSearchParams` imports not enumerated for `GoogleCallbackPage`.** Task 3 uses `navigate(...)` and reads URL params but only lists `apiFetch`/`ApiError`/`useAuth`/`AuthResponse` as imports. `useNavigate` and `useSearchParams` from `react-router-dom` are clearly implied ("mirror LoginPage/MagicLinkPage"), but note that `MagicLinkPage` uses `Link` rather than `useNavigate`, so the implementer must add `useNavigate` explicitly. Trivial, just don't overlook it.
- **ROADMAP line 21 correction** (see Roadmap gate) — recommend fixing the stale `googleCode`/`googleError` wording in the same change to prevent future drift.

## Positive Notes

- Critical contract bug from Review 1 is fully and correctly resolved, with the verified-against-source reasoning captured inline in the plan's "API contract" section.
- The "Coupled contract — do not split" callout is excellent: it documents *why* the param names and `redirectUri` are correct only under the live direct-to-web topology, preventing a future half-fix from silently breaking the exchange.
- Reuses established patterns throughout (`apiFetch`/`ApiError`, `auth.login`, spinner markup, `useRef` StrictMode guard, lazy-init + effect) consistent with `LoginPage`/`MagicLinkPage`.
- Correctly identifies the OAuth entry point as full-page navigation and justifies the single-fetch-point exception.

## Verdict

The plan is architecturally sound and, critically, now matches the verified mind_api/`.env` contract. The one Critical Issue from Review 1 is resolved and re-verified against source. Remaining items (missing import enumeration, stale ROADMAP wording) are non-blocking. Approved.

PLAN_REVIEW_PASS
