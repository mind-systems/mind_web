# Fix: Google OAuth Callback Parameter Names

**Date:** 2026-05-30
**Source:** Code review — cross-file contract tracer, confirmed by altitude scan

## Key Findings

- `GoogleCallbackPage` reads `?code=` and `?error=` but the API relays `?googleCode=` and `?googleError=`
- Google OAuth login is completely non-functional without this fix — every valid callback redirects to `/login?error=google`
- The rename is intentional on the API side to avoid the browser's own OAuth machinery re-intercepting a `?code=` parameter at the callback URL

## The fix

Two lines in `src/pages/GoogleCallbackPage/index.tsx`:

```typescript
// Line 19 — was: searchParams.get('code')
const code = searchParams.get('googleCode');

// Line 20 — was: searchParams.get('error')
const error = searchParams.get('googleError');
```

Nothing else changes. The `code` variable is then sent as-is to `POST /auth/google { code, redirectUri }`, which is correct.

## What NOT to change

- `LoginPage` reads `searchParams.get('error') === 'google'` to show the "Google sign-in failed" message. This is an internal contract between two web pages (not the API), and it is correct. Do not rename this.
- `MagicLinkPage` reads `searchParams.get('code')`. The magic-link email template sends `?code=` (no rename). Do not change this.
