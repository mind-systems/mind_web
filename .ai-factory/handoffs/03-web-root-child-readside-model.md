# Handoff — mind_web root/child read-side model rollout

> Audience: an agent working **inside `mind_web`** (separate git repo — the React/Vite/Recharts historical dashboard). This brief is authored from the `mind_api` side and explains how the realtime data model changed to **root/child continuous-bio-timeline**, what that means for the dashboard's **read-side** rendering, and where the authoritative answer for every detail lives. All `mind_api/...` paths are readable from the monorepo (`/Users/max/projects/mind/...`). **The read-side REST API is DONE & committed on `feature/root-session` and is backward-compatible — nothing the dashboard calls today breaks. This gets its own `/aif-plan` inside `mind_web`.**

## 1. Frame
`mind_api` restructured realtime sessions into a **continuous bio-timeline**: biometric samples now live on ONE **root session** per app-open (`activityType='root'`), and each practice (breath/meditation) is a flat **child session** that is a **time-window `[startedAt, endedAt)` on the shared root bio axis**. Children can **overlap** (concurrent activities on one timeline). `mind_web` is a **read-only consumer** — it renders historical runs + their biometrics/instructions via REST. **You do NOT touch proto or gRPC** — that is the mobile producer's world; the dashboard only reads REST.

The core mental shift: a run's biometrics are no longer "the run's own samples" — they are a **windowed slice of the root's continuous timeline**. The REST endpoints hide this (same calls, same response shapes), but the *model* the dashboard represents has changed, and faithful rendering (continuous axis, overlapping runs) is now both possible and expected.

## 2. Read-first map (all in `mind_api/`)

### Must-read now (minimal rehydration set)
- `docs/realtime/database.md` — the four tables in Russian: `module_sessions` (root + child, `rootSessionId`, `activityType`), `session_stream_samples` (instructions, keyed by child — and, going forward, root-level markers), `bio_session_samples` (bio, keyed by **root**), `user_stats`. The schema behind everything you read.
- `docs/realtime/biometric-aggregation.md` — the exact `GET /runs/:id/biometrics` query contract: raw vs `bucketSec` aggregated mode, `agg` modes, tiling, garbage-timestamp filtering, row caps. This is what your charts consume.
- `.ai-factory/notes/09-analytics-tolerant-bio-read.md` (`mind_api`) — **how a run's bio is resolved now**: `In([sessionId, rootSessionId])` windowed to `[startedAt, endedAt]`. The single most important read-side change.
- `.ai-factory/notes/07-exclude-root-from-stats.md` (`mind_api`) — root sessions are excluded from `listRuns` and from stats; you will never see a `root` row in `/sessions/runs`.
- `src/sessions/sessions.controller.ts` + `src/sessions/sessions.service.ts` (`mind_api`) — the actual committed REST surface and its logic. Ground truth if a doc and the code disagree.

### Read on demand
- `docs/realtime/overview.md` / `session-lifecycle.md` — the root/child model in prose (Russian). Note: these describe the realtime *write* side too; you only need the data-model parts.
- `docs/stats/stats.md` — `GET /users/me/stats` (streak, min-duration, root exclusion) if the dashboard shows stats.
- `.ai-factory/notes/15-deleterun-orphan-root-cleanup.md` (`mind_api`) — what `DELETE /runs/:id` does now (deletes the child, and its root if it was the last child).

## 3. Is the API ready? — YES (read-side), with one parked future piece
- **Ready & committed** (bio-timeline epic, Phases 57–59): `listRuns` excludes root; `listBiometrics` does the windowed root-or-child read; `deleteRun` cleans up an orphaned root; docs updated. These are the only read-side changes the model shift requires, and they are **live and backward-compatible**.
- **Does NOT affect you:** the generic session-data-flow epic (a1/a2/a3 — client-started root, ownership-addressed ingest) is entirely **write/realtime side** (the mobile producer). It changed proto + gRPC controllers, not the REST read endpoints. Ignore it.
- **Parked / NOT ready (future):** the **realtime-durability** epic adds `disconnected`/`reconnected` markers on the **root** timeline (to visualize connection-loss gaps) and makes abandoned-run `endedAt` accurate. It is specced but parked below a `---STOP---`, unimplemented. **Do not build connection-gap visualization yet** — the markers don't exist, and there is currently no read endpoint exposing root-level `session_event` markers to the dashboard (see §7). Ask the human when durability lands.

**Verdict:** not too early — hand this to the web `/aif-plan` now for the read-side model adoption; leave connection-gap features for later.

## 4. Next step
Run `/aif-plan` **inside `mind_web/`** for the read-side model adoption. The plan covers:
1. **No proto, no API-call signature changes required** — `/sessions/runs`, `/sessions/runs/:id/biometrics`, `/sessions/runs/:id/instructions` are unchanged in shape. Confirm the existing client still parses responses.
2. **Adopt the continuous-timeline model in rendering** (the real work): a run's biometrics are a window of the shared root axis. If the dashboard shows one run in isolation this is transparent; if it should show the **full app-open session** (multiple runs on one continuous bio axis), that is now possible — decide whether to build it.
3. **Handle overlapping runs** — two children can be live at once (e.g. breathing started mid-meditation), so their `[startedAt, endedAt)` intervals can overlap. Any timeline/list UI that assumed strictly sequential runs must tolerate overlap.
4. **Do not surface root sessions** — `/runs` already excludes them; don't add a raw session query that would expose `activityType='root'` rows.
5. **Tolerate legacy data** — pre-refactor runs have `rootSessionId = null`; their bio read falls back to the run's own samples (server-transparent). Both old and new runs render correctly.
6. Keep DTO/model shapes in sync with the response bodies (verify against `sessions.service.ts`, not memory).

## 5. Working discipline
- **Confirm-before-execute.** Show the plan and hold; never fabricate a contract detail — read it from `mind_api/src/sessions/*` or the named doc/note.
- **Never commit without explicit user permission.** Commit messages: short noun phrase, sentence case, no `feat:`/`fix:` prefix, no body for single-concern.
- **The dashboard is read-only.** No proto copy, no gRPC, no writes. Auth is the existing JWT bearer on REST (`JwtAuthGuard`) — untouched by this refactor.
- `.ai-factory/` files in **English**; `mind_api/docs/` are **Russian** (read them, don't rewrite them).
- Residual questions the docs/notes don't answer come back to the `mind_api` side (the human) — do not guess a contract.

## 6. Orientation (traps)
- **Bio is windowed from the ROOT, not owned by the run.** `GET /runs/:id/biometrics` returns the samples of the root timeline that fall in the child's `[startedAt, endedAt]` window. Same response shape as before; different provenance. Don't assume `bio.moduleSessionId === runId` (it is the root id for new runs).
- **Runs can overlap in time.** Concurrent children share one root axis. A Gantt/timeline must handle overlap; a "next/previous run" assumption of non-overlap may be wrong.
- **`/runs` never returns root rows** — root is excluded server-side. There is no "root run" in the list; the root is infrastructure, not a practice.
- **Instructions are per-child.** `/runs/:id/instructions` returns that child's instruction stream only. Root-level markers (and future connection events) live under the root id and are **not** returned by a child's instructions endpoint (see §7).
- **`from`/`to` on biometrics/instructions are optional windows** — omitting them defaults to the run's own `[startedAt, endedAt]`. Passing a wider window on a child would still be clamped to the run's slice of the root by the windowed read.

## 7. Known read-side gap (for later, not now)
Root-level `session_event` markers — the future `disconnected`/`reconnected` connection events (durability epic, parked) and any root-level annotations — are stored under the **root** id in `session_stream_samples`, but no REST endpoint currently exposes the root's markers to the dashboard (`/runs` excludes the root, and `/runs/:id/instructions` reads the child id). **When the durability epic lands and connection-gap visualization is wanted, the read side will need a new endpoint** (e.g. root markers overlapping a run's window). Flag this to the `mind_api` side then; do not stub it now.

## 8. Domain model spine (settled on the API side — do not re-litigate)
- **Root = one continuous bio axis per app-open** (`activityType='root'`, `rootSessionId=null`); bio binds to it. → `docs/realtime/database.md`, `notes/09`.
- **Child = a practice, a time-window on the root axis** (`rootSessionId = root.id`, real `activityType`). Children can overlap. → `docs/realtime/overview.md`.
- **A run's bio = the root's samples in `[child.startedAt, child.endedAt]`** (`In([sessionId, rootSessionId])` windowed). Legacy null-root runs fall back to own samples. → `notes/09`.
- **Root is excluded from runs + stats** — never a list row, never counted. → `notes/07`.
- **Instructions stay per-child**; bio is root-level. Two separate streams, joined by time window. → `docs/realtime/instruction-model.md`.

## 9. Hard rules
- Read-only REST consumer — no proto, no gRPC, no writes.
- Never commit without explicit permission; English `.ai-factory/`; no memory writes without a trigger phrase.
- Ground every contract detail against `mind_api/src/sessions/*` or the named doc/note — never guess.
- Do not rewrite `mind_api/docs/*` (Russian, owned by the API side) — read them.

## 10. Cross-cutting contract checklist (read-side REST — verify against `mind_api/src/sessions/sessions.controller.ts`)
All under `@Controller('sessions')`, `JwtAuthGuard` (JWT bearer):
- **`GET /sessions/runs?limit&offset`** → `listRuns` — the user's practice runs, **root excluded** (`activityType != root`). One row per child; includes `id`, `activityType`, timestamps, duration, etc. (verify the exact projection in `sessions.service.ts:listRuns`).
- **`GET /sessions/runs/:id/biometrics?from&to&bucketSec&agg`** → `listBiometrics` — the run's biometrics, **windowed from the root** (`In([id, rootSessionId])`, `ts ∈ [startedAt,endedAt]`). `bucketSec` → server-side aggregation; `agg` → aggregation mode; `from`/`to` → optional narrower window. Response shape unchanged. → `docs/realtime/biometric-aggregation.md`.
- **`GET /sessions/runs/:id/instructions?from&to`** → `listInstructions` — the child's instruction stream (per-child; root-level markers NOT included).
- **`DELETE /sessions/runs/:id`** (204) → `deleteRun` — deletes the child; if it was the root's last child, the root (and its orphaned bio) is deleted too; siblings keep the shared root. → `notes/15`.
- **Auth/errors:** standard REST — 401 (no/invalid JWT), 404 (run not found / not owned), 400 (bad UUID / query). No realtime error codes here.

## 11. Per-unit map with watch-points (dashboard-facing)
- **Runs list** → `/sessions/runs`; root already excluded. Watch: don't add a raw all-sessions query that leaks `root` rows; handle that runs may overlap in time.
- **Bio chart** → `/runs/:id/biometrics` (+ `bucketSec`/`agg` for downsampling). Watch: the returned bio is a **window of the root axis**, not the run's private samples; `moduleSessionId` on samples is the root id for new runs — don't key UI on it as if it were the run id.
- **Continuous-timeline view (new capability)** → if you build "all runs of one app-open session on one bio axis", you need to group children by their shared root — but the root is not exposed via `/runs`. Today you can only assemble it from the child runs' windows; a first-class root-timeline read is future work (see §7). Watch: don't invent a root endpoint — ask.
- **Instructions overlay** → `/runs/:id/instructions`; per-child. Watch: root-level marks/connection events are not here (future).
- **Delete run** → `DELETE /runs/:id`; may cascade the root. Watch: after deleting the last child of a session, that whole app-open session's bio is gone (root cascade) — reflect in the UI.
- **Legacy data** → old runs have `rootSessionId=null`; bio falls back to own samples. Watch: both paths must render; don't assume every run has a root.
