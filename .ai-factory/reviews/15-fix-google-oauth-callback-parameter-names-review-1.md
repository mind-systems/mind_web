# Code Review: Fix Google OAuth callback parameter names

## Scope
Reviewed the code change in `src/pages/GoogleCallbackPage/index.tsx` (the only source file changed). Other staged paths are `.ai-factory/` docs/notes/plans and are not code.

## Change under review
```diff
-    const code = searchParams.get('code');
-    const error = searchParams.get('error');
+    const code = searchParams.get('googleCode');
+    const error = searchParams.get('googleError');
```

## Verification

- **Correctness of the fix.** The API relays `?googleCode=` and `?googleError=`. Before the change the page read `code`/`error`, which were always `null`, so the `if (error || !code)` guard always fired and every Google sign-in redirected to `/login?error=google`. Reading `googleCode`/`googleError` restores the exchange. Confirmed correct.
- **Local variable names preserved.** `code` and `error` are kept, so the guard (line 22) and the `apiFetch` body field `code` (line 30) remain valid and unchanged. No downstream references broke.
- **No collateral changes.** `LoginPage` (`src/pages/LoginPage/index.tsx:14`) still reads `?error=google` — this is the internal round-trip set by the callback's own `navigate('/login?error=google')`, not a Google-relayed key, so it correctly stays as-is. `MagicLinkPage` (`src/pages/MagicLinkPage/index.tsx:17-18`) still reads `?code=`/`?error=` for its own `/auth/magic-link/verify` flow — untouched, correct.
- **Routing alignment.** `router.tsx` maps `/auth/google/callback` to `GoogleCallbackPage`, matching the `redirectUri` built in the request body. Consistent.
- **Error path.** On a Google-side failure the API now sends `googleError`, which makes `error` truthy and triggers the redirect to the login error screen. Behaves as intended.

## Runtime/edge-case considerations
- StrictMode double-invocation is still guarded by `didExchange` ref — unaffected by this change.
- No type mismatches: `searchParams.get` returns `string | null`, consumed the same way as before.
- No new security surface: `redirectUri` continues to use `window.location.origin`; no user-controlled data added to the request.

## Conclusion
The change exactly matches the plan, fixes the documented bug, and introduces no regressions, type errors, or security issues. No findings.

REVIEW_PASS
