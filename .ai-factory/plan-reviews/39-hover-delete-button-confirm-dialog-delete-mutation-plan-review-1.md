# Plan Review: Hover delete button + confirm dialog + delete mutation

**Plan:** `.ai-factory/plans/39-hover-delete-button-confirm-dialog-delete-mutation.md`
**Files Reviewed:** plan + `core/api/client.ts`, `pages/SessionsPage/{index,SessionList}.tsx`, `pages/LoginPage/index.tsx`, `core/types/index.ts`, `mind_api/src/sessions/sessions.controller.ts`, ARCHITECTURE.md, rules, ROADMAP.md, tsconfig, eslint config
**Risk Level:** 🟡 Medium

The plan is well-structured, internally consistent, and faithful to the existing code patterns (query key, LoginPage spinner/error idioms, presentational-component split). Two concrete issues will break or destabilize the implementation as written, plus a few smaller refinements.

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** WARN → PASS. The page-local `useDeleteSession` hook under `pages/SessionsPage/` is permitted (page-owned data). `DeleteConfirmDialog` in `src/components/` as props-only/no-fetch conforms to the shared-component rule. No boundary violations. `apiFetch` remains the single HTTP path. ✅
- **Rules (`.ai-factory/rules/`):** PASS. Naming (`PascalCase` component, `camelCase` hook), error handling via `ApiError`, no raw `localStorage`, no new env vars. ✅
- **Roadmap (`ROADMAP.md`):** WARN. Maps exactly to Phase 16 milestone "Hover delete button + confirm dialog + delete mutation". **The roadmap states this milestone "Depends on mind_api Phase 45 (`DELETE /sessions/runs/:id`)" — see Critical Issue #1.** The plan file omits that prerequisite.

## Critical Issues

### 1. Wrong assumption: the `DELETE /sessions/runs/:id` endpoint does not exist yet
Task 1 asserts: *"The `DELETE /sessions/runs/:id` endpoint returns `204 No Content`."* It does not. `mind_api/src/sessions/sessions.controller.ts` exposes only `GET runs`, `GET runs/:id/biometrics`, `GET runs/:id/instructions` — there is no `@Delete` handler anywhere in `mind_api/src` (only an unrelated `@DeleteDateColumn` in a breath-session entity). The ROADMAP confirms this is a cross-project dependency on **mind_api Phase 45**, which has not shipped.

Impact: the frontend can be built in isolation, but the delete action will return **404** at runtime, and any QA/verify pass will fail until the backend endpoint exists.

Action: add an explicit prerequisite line to the plan (e.g. under Context) — *"Blocked on mind_api Phase 45 — `DELETE /sessions/runs/:id` (204) must exist before this feature is functional; verification is blocked until then."* Also confirm the assumed contract once the endpoint lands: status `204` (vs `200`), and that delete cascades biometrics + instructions server-side (the dialog copy promises permanent removal of both).

### 2. Task 2 forces an unused import that breaks the build
Task 2 says: *"Import `apiFetch` **and `ApiError`** from `@/core/api/client`."* But the hook never uses `ApiError` — the plan explicitly defers `error instanceof ApiError` handling to the render site (Task 5, `SessionsPage`). `tsconfig.app.json` sets `"noUnusedLocals": true`, so an unused `ApiError` import makes `npm run typecheck` / `npm run build` **fail**.

Fix: `useDeleteSession.ts` should import only `apiFetch`. `ApiError` belongs solely in `SessionsPage/index.tsx` (Task 5), which already imports it.

## Issues

### 3. Task 4 auto-close `useEffect` is fragile and lint-flagged
The proposed "close when `confirmId !== null && !isDeleting && !deleteError`" effect has a race depending on its dependency array:
- If `confirmId` is **included** in the deps, the effect fires the instant the dialog opens (`confirmId` set, `isDeleting` still `false`, no error) and closes it immediately — the dialog never appears.
- If `confirmId` is **omitted** (the plan's "watching `isDeleting`/`deleteError`" wording), it works for the success path, but `eslint-plugin-react-hooks` (`flat.recommended` enables `react-hooks/exhaustive-deps`) will warn on the missing dep. Non-blocking for `eslint`'s exit code, but it's exactly the kind of fragile state-sync the plan itself flags as a risk.

Recommended simpler design: drive the close from the mutation result instead of inferring it from prop transitions. Either (a) have `SessionList`'s `onConfirm` call `await mutateAsync(id)` and `setConfirmId(null)` on resolve / leave open on reject, or (b) pass an `onDeleted` success callback down from `SessionsPage` (fired in the hook's `onSuccess`) and clear `confirmId` there. Both remove the ambiguous effect.

### 4. Trash `<button>` nested inside the row `<Link>` is invalid HTML
Task 4 places the trash `<button>` inside each row, which is a `<Link>` rendering an `<a>`. A `<button>` nested in an `<a>` is invalid HTML (interactive content inside interactive content) and can cause inconsistent event/hydration behavior, even though `e.preventDefault()/stopPropagation()` masks it in practice. Consider restructuring the row as a `relative` container with the `<Link>` as an absolutely-positioned overlay (or `::after` stretched link) and the `<button>` as a sibling above it — keeps the whole-card click target while keeping the button a valid sibling.

### 5. Dialog accessibility gaps (low)
`DeleteConfirmDialog` as specced has no `role="dialog"`/`aria-modal`, no Escape-to-close, and no focus management. Acceptable for an MVP, but for a destructive confirm consider at least `role="dialog"` + Escape calling `onCancel` (ignored while `isPending`, mirroring the overlay-click rule already in the plan).

### 6. No logging on a destructive action (low)
Settings say "Logging: minimal," and the plan adds none. Project rules require the `logger` facade from `@/core/observe` (never `console`). A single `logger.error` on delete failure (or `logger.info` on success) would be a reasonable minimal addition; optional given the stated setting.

## Positive Notes

- 204 guard in Task 1 is placed correctly (before `return res.json()`) and reuses the single HTTP path rather than adding a delete helper — matches the architecture's "single fetch point" principle.
- Cache key `['session-runs']` in the `invalidateQueries` call exactly matches the real `useInfiniteQuery` key in `SessionsPage/index.tsx`. ✅
- Navigate-away logic is correct: `selectedId` is sourced from `useParams().id`, the detail route is `/sessions/:id`, and `navigate('/sessions')` is the right escape.
- Error-surfacing pattern (`error instanceof ApiError ? error.message : 'Something went wrong'`) and the spinner span are copied verbatim from `LoginPage`, keeping UX consistent.
- Component responsibilities respect the dependency rules: shared dialog is props-only, page-local hook owns data, `SessionList` stays presentational via callback/state props.
- Sensible commit grouping (API+hook, then UI).

## Verdict

Resolve Critical #1 (state the backend dependency / confirm the contract) and Critical #2 (drop the unused `ApiError` import — a hard build break), and tighten the Task 4 close mechanism (#3). The remaining items are refinements. Not a pass as written.
