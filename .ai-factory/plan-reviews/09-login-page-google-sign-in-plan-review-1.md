# Plan Review: Login page — Google Sign-In (Review 1)

**Plan:** `.ai-factory/plans/09-login-page-google-sign-in.md`
**Files Reviewed:** plan + LoginPage, GoogleCallbackPage, router, config, api/client, AuthContext, types, MagicLinkPage (mind_web); google-callback.controller, google-code-exchange.dto, auth-response.dto, `.env` (mind_api)
**Risk Level:** 🔴 High

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** WARN → mostly aligned. The plan correctly keeps all HTTP in `apiFetch`, keeps `localStorage` out of pages (uses `auth.login`), and adds no fetch to shared components. One soft deviation: `window.location.href = ${API_BASE_URL}/auth/google` is a deliberate full-page navigation (not a `fetch`), so it does not violate the "single fetch point" rule — acceptable, and the plan calls this out explicitly. No blocking issue.
- **Rules:** No `.ai-factory/RULES.md`; `CLAUDE.md` rules checked. The plan respects: English only, `mind_auth_token` untouched, no raw `fetch` in pages (the redirect is navigation, not fetch), `localStorage` confined to `core/`. OK.
- **Roadmap (`ROADMAP.md`):** Linked. Matches the open item "Login page: Google Sign-In" (line 21). **However the roadmap item itself encodes the same contract assumption that is wrong** — see Critical Issue 1.
- **skill-context:** `.ai-factory/skill-context/aif-review/SKILL.md` absent — no project-specific review overrides to apply.

## Critical Issues

### 1. 🔴 Callback query-param names (`googleCode`/`googleError`) do not match what Google actually sends to the web app — the flow will always fail

The plan (Task 3) reads `googleCode` and `googleError` from the callback URL and treats their absence as failure (`navigate('/login?error=google')`).

But the API configures Google to redirect **directly to the web app**, not via the API relay:

- `mind_api` `google-callback.controller.ts` → `startGoogleOAuth` (`GET /auth/google`) sets `redirect_uri: WEB_REDIRECT_URI`.
- `mind_api/.env`: `WEB_REDIRECT_URI=http://localhost:5173/auth/google/callback` — this is the **mind_web** dev origin (the `.env` comment even states "CORS … must match the mind_web host (same origin as WEB_REDIRECT_URI)"). Dev/prod values point to `web.dev.mind-awake.life` / `web.mind-awake.life` — all the web host.

So after consent, Google redirects the browser straight to `…/auth/google/callback?code=<authcode>&scope=…&authuser=…&prompt=…` using **standard OAuth param names `code` and `error`** — not `googleCode`/`googleError`.

The `googleCode`/`googleError` names only exist inside the API's `GET /auth/google/callback` *relay* handler, which rewrites `code`→`googleCode` and redirects to `APP_BASE_URL` (the **deeplink/mobile** host `dev.mind-awake.life`). That relay path is not in the web flow at all — Google never hits the API callback for the web client.

**Consequence as written:** `searchParams.get('googleCode')` is always `null` on the real redirect, so the page takes the "no code" branch and bounces every successful Google login to `/login?error=google`. Google Sign-In never completes.

**Fix:** read the standard params: `const code = searchParams.get('code'); const error = searchParams.get('error');`. (The ROADMAP line 21 description carries the same incorrect `googleCode`/`googleError` assumption and should be corrected too.)

> Note the internal inconsistency this exposes: the plan pairs the *relay-flow* param names (`googleCode`) with a *direct-flow* `redirectUri` (`window.location.origin + '/auth/google/callback'`, see Issue 2). Those two belong to two different deployment topologies; only one can be live. Per the committed `.env`, the live topology is **direct-to-web**, so the param names are the half that is wrong.

### 2. 🟢→verify `redirectUri` value happens to be correct for the live config — keep it that way

Task 3 sends `redirectUri: window.location.origin + '/auth/google/callback'`. The API's `POST /auth/google` strictly validates `dto.redirectUri === WEB_REDIRECT_URI` and throws `BadRequestException('Invalid redirectUri')` otherwise.

For the live config, `window.location.origin + '/auth/google/callback'` resolves to exactly `WEB_REDIRECT_URI` (e.g. `http://localhost:5173/auth/google/callback`), so this matches. ✅ No change needed — but this is load-bearing: it only works because Google redirects to the web origin. If anyone "fixes" Issue 1 by reintroducing an API-side relay (pointing `WEB_REDIRECT_URI` at the API host), this `redirectUri` would then mismatch and every exchange would 400. Flag both as a single coupled contract; do not change one without the other.

## Non-blocking notes

- **Error param `error` collision.** Once Issue 1 is fixed, the callback reads Google's `error` param and redirects to `/login?error=google`; LoginPage (Task 2) reads `error=google`. The two `error` params live on different routes (`/auth/google/callback` vs `/login`), so there is no real collision — just be aware the names overlap.
- **Task 2 clearing `error=google` must be an effect, not a render-time call.** The plan offers "lazy `useState` initializer **or** one-shot `useEffect`." A lazy `useState` initializer can read `searchParams` but must **not** call `setSearchParams` (side effect during render). If the lazy initializer is chosen to seed the message, the param-clearing still has to happen in a `useEffect`. The `MagicLinkPage` pattern (lazy init for state + `useRef`-guarded effect) is the right template to mirror.
- **AuthResponse type drift (pre-existing, not introduced here).** Web `AuthResponse.user` is `{ id, email }`; the API `UserResponseDto` returns `{ id, email, name, role, language }`. The plan only consumes `accessToken`, so this is harmless for this task — noting it so it isn't mistaken for new breakage.
- **StrictMode guard is correct.** Setting the `useRef` flag synchronously before the async `apiFetch`, as in `MagicLinkPage`, properly prevents the double `POST /auth/google` (important here because the OAuth `code` is single-use — a second exchange would fail).
- **`POST /auth/google` returns 200 + `{ accessToken, user }`** (`@HttpCode(HttpStatus.OK)` + `AuthResponseDto`). Matches the plan's `res.accessToken` usage. ✅
- **`apiFetch` 401 auto-redirect won't interfere.** During callback there is no stored token, and the 401 branch in `client.ts` only fires when a token is present, so a failed exchange falls through to the plan's `catch → navigate('/login?error=google')`. ✅
- **Optional `language` field** on `GoogleCodeExchangeDto` is correctly omitted by the plan (it's `@IsOptional()`).

## Positive Notes

- Correctly identifies that the OAuth entry point is a full-page navigation, not an `apiFetch` call, and justifies the architectural exception.
- Reuses established patterns (`apiFetch`/`ApiError`, `useAuth().login`, spinner markup, `useRef` StrictMode guard) consistent with `LoginPage`/`MagicLinkPage`.
- Route `/auth/google/callback` already exists and is public — plan correctly notes no router change is needed (verified in `router.tsx`).
- Good attention to cleaning the `error=google` param from the URL so an OTP retry starts clean.

## Verdict

The plan is well-structured and architecturally sound, but **Critical Issue 1 means the implemented page would not work against the current API/env contract** — the callback reads param names that the live redirect never produces. Resolve the param-name mismatch (and confirm the redirect topology so Issue 2 stays valid) before implementing. Not approved as written.
