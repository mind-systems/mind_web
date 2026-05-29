# Mind Web — Roadmap

## Phase 1 — Project Bootstrap

- [ ] **Scaffold Vite + React + TypeScript project** — Run `npm create vite@latest . -- --template react-ts` inside `mind_web/`. Set `name: mind-web` in `package.json`. Add `engines: { "node": ">=20" }`. Install runtime deps: `react-router-dom`, `@tanstack/react-query`, `echarts`, `echarts-for-react`. Install dev deps: `@types/react`, `@types/react-dom`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`. Delete the generated Vite boilerplate files (`src/App.css`, `src/assets/`, `public/vite.svg`). Task ends when `npm run dev` starts a blank page with no console errors.

- [ ] **Configure TailwindCSS** — Install `tailwindcss`, `postcss`, `autoprefixer` as dev deps. Run `npx tailwindcss init -p`. Set `content: ["./index.html", "./src/**/*.{ts,tsx}"]` in `tailwind.config.js`. Add `@tailwind base/components/utilities` to `src/index.css`. Replace `index.html` title with `Mind`. Task ends when a `className="text-blue-500"` element renders in the correct color.

- [ ] **Configure project structure and environment** — Create directories: `src/core/api/`, `src/core/auth/`, `src/core/types/`, `src/pages/`, `src/components/`. Create `.env.local` (gitignored) with `VITE_API_BASE_URL=http://localhost:3002`. Create `.env.example` with the same key and an empty value. Create `src/core/config.ts` exporting `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string` with a startup assertion that it is non-empty. Configure `@` path alias in `vite.config.ts` and `tsconfig.json`. Task ends when `import { API_BASE_URL } from '@/core/config'` resolves without errors.

- [ ] **Configure React Router and page shells** — Create `src/router.tsx` with `createBrowserRouter`. Routes: `/login` → `LoginPage` (public), `/deeplink-auth` → `MagicLinkPage` (public), `/auth/google/callback` → `GoogleCallbackPage` (public), `/sessions` → `SessionsPage` (protected), `/sessions/:id` → `SessionsPage` with selected session (same component, protected), `/calibrations` → `CalibrationPage` (protected), `/` → redirect to `/sessions`. `ProtectedRoute` redirects to `/login` when token absent. Create stub components for each page. Wrap `src/main.tsx` with `RouterProvider`, `QueryClientProvider`, `AuthProvider`. Task ends when navigating to each URL renders the correct stub.

## Phase 2 — Authentication

- [ ] **Auth context + token management** — Create `src/core/auth/AuthContext.tsx`. Context value: `{ token: string | null; login(token: string): void; logout(): void }`. Token persisted in `localStorage` under `mind_auth_token`. `login()` stores token and navigates to `/sessions`. `logout()` clears token and navigates to `/login`. Export `useAuth()` hook. `ProtectedRoute` reads from `useAuth().token`. Task ends when `useAuth().logout()` from a protected page redirects to `/login`.

- [ ] **Login page: email OTP flow** — Implement `LoginPage`. Step 1: email input + "Send code" button → `POST /auth/send-code { email }`. On success: store email in `localStorage` under `mind_pending_email` (needed for magic link callback), advance to step 2. Step 2: 6-digit code input + "Verify" button → `POST /auth/verify-code { email, code }` returns `{ token }` → `auth.login(token)`. Show loading spinner during requests. Show inline error on failure (extract `message` field from response body). Centered card, max-width 400px. Note: these REST endpoints must be added to mind_api first (see Phase 3).

- [ ] **Magic link auto-login** — Implement `MagicLinkPage` at `/deeplink-auth`. The API email template already contains `{APP_BASE_URL}/deeplink-auth?code=XXXXXX` — on mobile this opens as a native deeplink, in a browser this hits this route. On mount: read `?code=` from URL query params. Read `mind_pending_email` from `localStorage` (stored when the user submitted the send-code form). If both present: call `POST /auth/verify-code { email, code }` → `auth.login(token)` → navigate to `/sessions`. If code is present but no pending email: show a short email input so the user can confirm their address, then verify. Clear `mind_pending_email` after successful login. No changes to API email templates needed — the existing deeplink URL works for web as-is.

- [ ] **Login page: Google Sign-In** — Add "Continue with Google" button on `LoginPage`. On click: call `GET /auth/google` → API redirects browser to Google OAuth. After Google auth, API relays to `{WEB_BASE_URL}/auth/google/callback?googleCode=<code>` (success) or `?googleError=<err>` (failure). Implement `GoogleCallbackPage`: on `googleCode` → call `POST /auth/google { code, redirectUri: window.location.origin + '/auth/google/callback' }` → receive `{ token }` → `auth.login(token)`. On `googleError` → redirect to `/login?error=google`. Note: verify exact endpoint names and response shape from mind_api before implementing — see Phase 3.

- [ ] **API client with auth interceptor** — Create `src/core/api/client.ts`. `apiFetch<T>(path, options?)`: prepend `API_BASE_URL`, add `Content-Type: application/json` and `Authorization: Bearer <token>` headers. On 401: clear token, navigate to `/login`. On non-2xx: throw `ApiError(status, message)` with message extracted from response JSON. Task ends with the client used by at least one page.

## Phase 3 — mind_api: REST Endpoints

All web-facing auth endpoints are new — the existing auth transport is gRPC (mobile-only). Historical data endpoints are also new.

### Auth endpoints (web-specific additions to mind_api)

- [ ] **`POST /auth/send-code`** — REST wrapper over existing `SendCode` gRPC logic. Body: `{ email, locale? }`. Returns `{ message }`. Rate-limit and cooldown logic is unchanged (reuses the same service).

- [ ] **`POST /auth/verify-code`** — REST wrapper over existing `VerifyCode` gRPC logic. Body: `{ email, code }`. Returns `{ token, user }`. Creates session, returns JWT.

- [ ] **`GET /auth/google`** — Initiates browser OAuth flow. Constructs Google OAuth URL with `GOOGLE_CLIENT_ID`, `WEB_REDIRECT_URI` (new env var), and required scopes. Redirects browser to Google.

- [ ] **`POST /auth/google`** — REST counterpart to `GoogleAuth` gRPC. Body: `{ code, redirectUri }`. Exchanges code via Google, returns `{ token, user }`.

- [ ] **`WEB_REDIRECT_URI` for Google OAuth** — Add `WEB_REDIRECT_URI` env var to mind_api (value: `{APP_BASE_URL}/auth/google/callback`). Register this URI in Google Cloud Console as an authorized redirect URI for the existing OAuth client (Web application type — confirmed by presence of `GOOGLE_CLIENT_SECRET`). No new Google client needed.

### Historical data endpoints

- [ ] **`GET /sessions/runs`** — Paginated list of completed `module_sessions` for authenticated user, ordered by `started_at DESC`. Query params: `?limit=50&offset=0`. Response per item: `{ id, startedAt, endedAt, durationSeconds }`. Only sessions where `ended_at IS NOT NULL`. Protected by `JwtAuthGuard` + `@CurrentUser()`.

- [ ] **`GET /sessions/runs/:id/biometrics`** — All `bio_session_samples` for a session, ownership-checked. Flatten the `samples` jsonb arrays: response is a flat `BioSampleDto[]` array, each with `{ timestamp, sampleType, data }`. Ordered by `flushedAt ASC`.

- [ ] **`GET /sessions/runs/:id/instructions`** — All `session_stream_samples` for a session, ownership-checked. Same flattening: flat array of `{ timestamp, type, payload }`. Ordered by `flushedAt ASC`.

- [ ] **`GET /nfb-calibrations`** — All `nfb_calibration_records` for authenticated user, ordered by `created_at DESC`. Optional `?deviceSerial=` filter. Response: `{ records: NfbCalibrationRecordDto[] }` with all 13 entity fields.

## Phase 4 — Sessions Split-Panel Page

Single page at `/sessions` (and `/sessions/:id` for selected state). Left column: session list. Right panel: session charts. Selecting a session updates the URL to `/sessions/:id` and populates the right panel — no page navigation.

- [ ] **Split-panel layout shell** — Implement `SessionsPage` with a two-column layout: left column fixed-width (~280px), right panel fills remaining width. Left column header: "Sessions" title + logout button. Right panel: empty state ("Select a session") when no session selected. Use TailwindCSS `flex h-screen overflow-hidden`. Left column is scrollable independently. Right panel is scrollable independently.

- [ ] **Session list (left column)** — Fetch `GET /sessions/runs` via React Query. Render a scrollable list of session rows: date (`DD MMM, HH:mm`) + duration (`mm:ss`). Selected session highlighted. Clicking a row navigates to `/sessions/:id` (via React Router, no reload). "Load more" at the bottom loads next page. Skeleton loader while fetching. "No sessions yet" empty state.

- [ ] **Session charts panel (right panel) — ECharts multi-grid** — When `/sessions/:id` is active, right panel fetches `GET /sessions/runs/:id/instructions` and `GET /sessions/runs/:id/biometrics` in parallel. Renders a single ECharts instance with multiple stacked grids sharing the same X-axis (seconds from session start, `type: 'value'`). Grid layout (top to bottom): (1) instruction phases — horizontal colored bars per phase (inhale `#a4f792`, hold `#f8f08d`, exhale `#8dd6f8`, rest `#8d8df8`), each bar labeled with phase name; (2) heart rate — single line `#f88d8d`, Y-axis "BPM"; (3) EEG bands — 5 lines: delta `#8dd6f8`, theta `#b48df8`, alpha `#f8f08d`, SMR `#8df8e4`, beta `#f8b08d`; (4) emotions — 5 lines: attention `#c88df8`, relaxation `#a4f792`, cognitiveLoad `#a1bff6`, cognitiveControl `#f8c88d`, selfControl `#f88db8`. All X-axes linked: `dataZoom` with `xAxisIndex: [0,1,2,3]` — zooming/scrolling moves all panels together. `axisPointer.link` with `xAxisIndex: 'all'` — crosshair moves across all panels simultaneously. If a bio sample type is absent, hide that grid entirely. Panel header: formatted date + total duration.

## Phase 5 — NFB Calibration History Page

- [ ] **`/calibrations` page** — Fetch `GET /nfb-calibrations`. Group records by `deviceSerial`. For each device: section header with serial + "valid / total" badge. Three ECharts `LineChart` instances (X-axis: calibration date, Y-axis: value): `individualFrequency` (Hz), `individualBandwidth` (Hz), `individualNormalizedPower`. Invalid calibrations: hollow red dots. Valid: filled green dots. Tooltip shows `calibratedAt`, `isValid`, `failReason`. Empty state: "No calibrations recorded yet".
