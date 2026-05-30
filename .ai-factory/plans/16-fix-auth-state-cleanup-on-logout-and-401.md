# Plan: Fix auth state cleanup on logout and 401

## Context
Fix two auth bugs: `logout()` leaving a stale `mind_pending_email` that mismatch-verifies on the next magic-link visit, and `apiFetch` throwing `ApiError` after a hard `/login` navigation, racing callers' catch handlers.

> Note: the referenced spec `notes/06-auth-state-cleanup.md` does not exist in the repo. This plan follows the milestone description, which is self-contained and matches the current source.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Auth state fixes

- [x] **Task 1: Clear pending email in `logout()`**
  Files: `src/core/auth/AuthContext.tsx`
  In the `logout` callback (currently removes `TOKEN_KEY` and sets token to null before navigating), also clear the pending email inline: call `localStorage.removeItem(PENDING_EMAIL_KEY)` and `setPendingEmailState(null)` before `navigate('/login', { replace: true })`. Do not call `clearPendingEmail` indirectly — inline the two statements to keep `logout`'s dependency array unchanged. Keep the existing `login` comment/behavior untouched.

- [x] **Task 2: Stop `apiFetch` from throwing after 401 redirect**
  Files: `src/core/api/client.ts`
  In the `!res.ok` branch, when `res.status === 401 && token`: after `localStorage.removeItem(TOKEN_KEY)` and `window.location.assign('/login')`, `return new Promise<T>(() => {})` so the function never resolves or rejects, preventing any caller catch handler from firing during the hard navigation. The unconditional `throw new ApiError(res.status, msg)` remains for all other (non-401) error cases.

## Validation
- Run `npm run lint` and `npm run typecheck` — both must pass.
