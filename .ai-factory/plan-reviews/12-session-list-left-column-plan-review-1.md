# Plan Review: Session list (left column)

**Plan:** `.ai-factory/plans/12-session-list-left-column.md`
**Risk Level:** 🟢 Low

## Verification Against Codebase

I verified every reconnaissance claim and assumption against the actual source:

- **Endpoint shape — CONFIRMED.** `mind_api/src/sessions/sessions.controller.ts` exposes `@Get('runs')` under `@Controller('sessions')` guarded by `JwtAuthGuard`. `sessions.service.ts#listRuns` returns `{ items: { id, startedAt, endedAt, durationSeconds }[], total }`, ordered `startedAt DESC`, `take = min(limit ?? 50, 200)`, `skip = offset ?? 0`. DTO (`list-runs-query.dto.ts`) enforces `limit` 1–200 and `offset` ≥ 0. The plan's description is accurate.
- **Date serialization — CORRECT.** The service returns `Date` objects, but over JSON these serialize to ISO strings, so the plan typing `startedAt: string` / `endedAt: string` is right.
- **Pagination termination is sound.** `total` comes from `findAndCount` (respects the `endedAt IS NOT NULL` where-clause, ignores take/skip). The `flatMap` filter in the service never drops rows because the where-clause already excludes null `endedAt`. Therefore `sum(items across pages) === total` at completion, and the `getNextPageParam` "stop when `loadedCount >= total`" logic converges correctly with no off-by-one.
- **Host page — CONFIRMED.** `src/pages/SessionsPage/index.tsx` has the placeholder `{/* session list — next milestone */}` inside `flex-1 overflow-y-auto`, and `useParams<{ id?: string }>()` is already in place.
- **API client — CONFIRMED.** `apiFetch<T>(path, options?)` exists in `src/core/api/client.ts`; 401 handling clears the token and redirects. Signature matches the plan's usage.
- **TanStack Query v5 — CONFIRMED.** `@tanstack/react-query@^5.100` is installed; `QueryClientProvider` wraps the app in `main.tsx`. `useInfiniteQuery` with `initialPageParam` + `getNextPageParam` is the correct v5 API, and `isLoading` / `isFetchingNextPage` / `hasNextPage` / `fetchNextPage` are all valid v5 return fields.
- **Architecture alignment — CORRECT.** `SkeletonLoader.tsx` is already referenced in `ARCHITECTURE.md` under `components/`. `SessionList.tsx` placed as a page sub-component (sibling to `index.tsx`) matches the established pattern (`InstructionTimeline`, `BiometricCharts`). The "pages own `useQuery`, components are presentational props-only" rule is respected — the fetch lives in the page and `SessionList` takes data via props.
- **No new dependency / no migration needed.** Native `Date`/`Intl` formatting is appropriate; this is a read-only frontend task with no DB or proto impact.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** PASS. Dependency rules honored — fetch in page, presentation in component, shared `SkeletonLoader` in `components/` importing only `core/types`. No raw `fetch`, no `localStorage` access introduced.
- **Rules (`.ai-factory/RULES.md`):** File is empty — no explicit rules to enforce. Project CLAUDE.md rules (English-only, all HTTP via `client.ts`, no `useQuery` in shared components) are all satisfied by the plan.
- **Roadmap (`.ai-factory/ROADMAP.md`):** PASS. Maps 1:1 to the open Phase 3 task "Session list (left column)". Strong linkage; scope matches.

## Advisory Notes (non-blocking — WARN)

1. **`WARN` — React Router version label.** The plan (and ARCHITECTURE.md) refer to "React Router v6", but `package.json` pins `react-router-dom@^7.16.0`. No functional impact: `Link` and `useParams` are API-compatible across v6/v7 for this usage. Just don't let the stale label cause confusion during implementation.

2. **`WARN` — No error state for the runs query.** The plan covers loading (skeleton) and empty states but not the error path. `ARCHITECTURE.md` lists a `components/ErrorMessage.tsx`. Consider passing `isError`/`error` into `SessionList` (or rendering an error fallback in the page) so a failed `/sessions/runs` call shows a message rather than an indefinite empty/skeleton state. Minor, but cheap to add in Task 4/5.

3. **`WARN` — Query key not user-scoped.** Key `['session-runs']` is global. `AuthContext.logout()` navigates client-side (no full reload), so the QueryClient cache survives a logout → re-login as a different user could briefly surface the previous user's list. The 401-triggered `window.location.assign('/login')` in `client.ts` does hard-reload and clears it, so this only matters for an explicit logout. Low severity for an MVP; optionally scope the key or call `queryClient.clear()` on logout in a later task.

## Positive Notes

- Reconnaissance is unusually accurate — every endpoint, file path, and type claim checked out against source.
- Correct, idiomatic v5 infinite-query design with a convergent stop condition.
- Clean task dependency ordering (types/helpers → component → wiring) with explicit `depends on` markers.
- Respects all architecture/dependency boundaries; no scope creep into API or proto.
- Duration helper explicitly handles the ≥ 60-minute edge case.

## Verdict

The plan is implementable as written with no blocking issues. The three advisory items are quality improvements, not corrections.

PLAN_REVIEW_PASS
