# Plan: Fix Google OAuth callback parameter names

## Context
`GoogleCallbackPage` reads the wrong query-string keys (`code`/`error`) while the API relays `googleCode`/`googleError`, so Google sign-in always fails the guard and redirects back to login. This corrects the two parameter names to restore the flow.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Fix callback parameter parsing

- [x] **Task 1: Read the correct query parameters in GoogleCallbackPage**
  Files: `src/pages/GoogleCallbackPage/index.tsx`
  In the `useEffect` (lines 19-20), change `searchParams.get('code')` to `searchParams.get('googleCode')` and `searchParams.get('error')` to `searchParams.get('googleError')`. Keep the local variable names `code` and `error` so the rest of the effect (guard at line 22, the `code` field in the `apiFetch` body at line 30) stays unchanged. Do NOT touch `LoginPage`'s `?error=google` round-trip or `MagicLinkPage`'s `?code=` — those use the correct keys for their own flows.

## Notes
- The spec referenced at `notes/05-google-callback-fix.md` does not exist in the repo; the milestone description is treated as the authoritative spec.
- Single-task change → single commit at the end, no commit plan needed.
