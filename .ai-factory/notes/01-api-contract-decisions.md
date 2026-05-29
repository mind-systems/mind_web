# API Contract Decisions — Phase 3 (mind_api REST Layer)

**Date:** 2026-05-29
**Source:** conversation context — mind_api Phase 21 planning session

## Key Findings

- Auth endpoints are REST wrappers over existing gRPC services — response shapes are identical to what the gRPC layer already produces (`AuthResponseDto`).
- Biometrics and instructions use **time-range pagination** (`?from=<ISO>&to=<ISO>`), not offset — a multi-hour session can produce enormous payloads; the frontend fetches only the visible chart window.
- NFB calibrations use **standard offset pagination** and return `{ records, total }` — not a flat array.
- Session runs list returns `{ items, total }` with `?limit&offset` — the only endpoint with offset pagination besides calibrations.

## Details

### Auth Endpoints

All four auth endpoints live under `/auth/`. Implemented as a new HTTP controller inside `AuthModule` (parallel to `AuthGrpcController`). No new business logic — pure service delegation.

| Endpoint | Body | Response |
|----------|------|----------|
| `POST /auth/send-code` | `{ email, locale? }` | `{ message: 'ok' }` |
| `POST /auth/verify-code` | `{ email, code }` | `AuthResponseDto` → `{ accessToken, user }` |
| `GET /auth/google` | — | 302 redirect to Google OAuth URL |
| `POST /auth/google` | `{ code, redirectUri }` | `AuthResponseDto` → `{ accessToken, user }` |

- `send-code` and `verify-code` are unauthenticated (no guard).
- `GET /auth/google` constructs the OAuth URL server-side from `GOOGLE_CLIENT_ID` + `WEB_REDIRECT_URI` env var and redirects the browser.
- `POST /auth/google` reuses the same internal service path as the gRPC `GoogleAuth` method — same `exchangeCodeForProfile(code, redirectUri)` call.
- New env var on the API: `WEB_REDIRECT_URI = {APP_BASE_URL}/auth/google/callback`. This URI must also be registered in Google Cloud Console (no new OAuth client needed — the existing Web application client is already the right type).

### Google OAuth Callback Flow

The existing `GET /auth/google/callback` relay is unchanged — it reads `?code=` from Google's redirect and relays to `{APP_BASE_URL}/auth/google/callback?googleCode=<code>`.

Full browser flow:
1. User clicks "Continue with Google" → `GET /auth/google` → API redirects to Google
2. Google redirects to `GET /auth/google/callback?code=...` on the API
3. API relays to `{APP_BASE_URL}/auth/google/callback?googleCode=<code>`
4. Web reads `googleCode`, calls `POST /auth/google { code, redirectUri }` → receives JWT

### Magic Link

No API changes. The existing email template already contains `{APP_BASE_URL}/deeplink-auth?code=XXXXXX`. On mobile it opens as a native deeplink; in a browser it hits the web's `/deeplink-auth` route. The web handles it:
1. Read `?code=` from URL
2. Read `mind_pending_email` from `localStorage` (stored when the user submitted send-code)
3. Call `POST /auth/verify-code { email, code }` → login
4. If no pending email: show a short email input before verifying

### Session Runs List

```
GET /sessions/runs?limit=50&offset=0
→ { items: [{ id, startedAt, endedAt, durationSeconds }], total: number }
```

- `durationSeconds` is computed server-side: `Math.round((endedAt - startedAt) / 1000)`
- Only completed sessions (`ended_at IS NOT NULL`), ordered `startedAt DESC`
- Max `limit` capped at 200 server-side
- Protected by `JwtAuthGuard` + `@CurrentUser()`

### Session Biometrics + Instructions (Time-Range)

```
GET /sessions/runs/:id/biometrics?from=<ISO>&to=<ISO>
→ [{ timestamp, sampleType, data }, ...]   (flat array)

GET /sessions/runs/:id/instructions?from=<ISO>&to=<ISO>
→ [{ timestamp, type, payload }, ...]      (flat array)
```

- **Both `from` and `to` are optional** ISO 8601 timestamps (absolute, not relative to session start). If omitted, all rows are returned.
- The server filters the `bio_session_samples` / `session_stream_samples` rows by `flushedAt >= from AND flushedAt < to`, then flattens the `samples` jsonb array from each matching row.
- Ordered `flushedAt ASC` before flattening.
- Ownership-checked: 404 if session not found, 403 if session belongs to another user.
- **Why time-range over offset:** A multi-hour session produces enormous payloads. The ECharts chart has a shared `dataZoom` — on scroll, the frontend should request only the newly visible time window and append to the existing dataset. Using absolute timestamps means the frontend converts `session.startedAt + visibleOffsetSeconds` to get `from/to`.

**Recommended fetch strategy for the frontend:**
- Initial load: request full session range (`from=session.startedAt&to=session.endedAt`). For short sessions this is fine; for long sessions consider requesting only the last N minutes initially.
- On dataZoom scroll left (into uncached range): request `?from=<earliest uncached>&to=<already loaded from>` and prepend to dataset.

### NFB Calibrations (Offset Pagination)

```
GET /nfb-calibrations?deviceSerial=<optional>&limit=50&offset=0
→ { records: [NfbCalibrationRecordDto], total: number }
```

- `deviceSerial` is optional — if omitted, returns calibrations for all devices of the authenticated user
- Ordered `createdAt DESC`
- All 13 entity fields present in each record: `id`, `userId`, `deviceSerial`, `calibratedAt`, `isValid`, `failReason`, `individualFrequency`, `individualPeakFrequencyPower`, `individualPeakFrequencySuppression`, `individualBandwidth`, `individualNormalizedPower`, `lowerFrequency`, `upperFrequency`, `createdAt`
- Protected by `JwtAuthGuard` + `@CurrentUser()`
- **Why `{ records, total }` and not flat array:** calibration history grows over time; offset pagination lets the `/calibrations` page load more as the user scrolls

### Response Shape Summary

| Endpoint | Response shape | Pagination |
|----------|----------------|------------|
| `POST /auth/send-code` | `{ message }` | — |
| `POST /auth/verify-code` | `{ accessToken, user }` | — |
| `GET /auth/google` | 302 redirect | — |
| `POST /auth/google` | `{ accessToken, user }` | — |
| `GET /sessions/runs` | `{ items, total }` | offset (`limit`, `offset`) |
| `GET /sessions/runs/:id/biometrics` | flat array | time-range (`from`, `to`) |
| `GET /sessions/runs/:id/instructions` | flat array | time-range (`from`, `to`) |
| `GET /nfb-calibrations` | `{ records, total }` | offset (`limit`, `offset`) |

### Auth Header

All protected endpoints expect `Authorization: Bearer <accessToken>` in the HTTP header. Token format is JWT, same as gRPC — issued by `POST /auth/verify-code` or `POST /auth/google`.

## Resolved

- **Initial chart load strategy:** fetch the full session range (`from=startedAt&to=endedAt`) on mount. The API time-range params exist for future lazy-loading optimization, but the MVP fetches everything upfront. No incremental dataZoom loading in Phase 3.
