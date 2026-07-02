## Code Review Summary

**Files Reviewed:** 3 target files + 5 context/consumer files (ModuleBadge, ModuleFilter, SessionList, sessionTitle, SessionCharts, API enum, tsconfig, ROADMAP, spec note 45)
**Risk Level:** 🟢 Low

This is a plan review. Every assumption in the plan was verified against the live codebase.

### Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`): No violation. All three edits stay inside their existing feature modules (`core/types`, `components`, `pages/SessionsPage`) and preserve current dependency directions — no new cross-boundary imports. WARN: none.
- **Rules** (`rules/base.md`; no `RULES.md` present): No explicit convention violated. Changes are English-only, touch no `mind_auth_token`, no proto files, no raw `fetch`, no storage access, no `useQuery` inside shared components. WARN: none.
- **Roadmap** (`ROADMAP.md`): Milestone linkage is present and exact. The plan mirrors the contract line at `ROADMAP.md:199` and the governing spec `notes/45-activitytype-root-contract.md` field-for-field (union widening, `Partial<Record>` rationale, `.filter` placement, the "do NOT add `rootSessionId` / do NOT widen `endedAt` / no `root` tab" guards). WARN: none.

### Critical Issues

None.

### Verification of Plan Claims

- **Task 1** — `mind_api/src/realtime/enums/activity-type.enum.ts` is confirmed to be `BREATH | MEDITATION | ROOT`, and `src/core/types/index.ts:11` is currently `'breath' | 'meditation'`. Widening to include `'root'` is correct and matches the wire enum. `SessionRun` (lines 13–21) already matches the `listRuns` projection field-for-field, so leaving it untouched is right.
- **Task 2** — `MODULE_LABELS` and `MODULE_STYLES` are exhaustive `Record<ActivityType, string>` object literals (`moduleMeta.ts:3,8`). Once the union gains `'root'`, these literals would fail with TS2741 ("Property 'root' is missing") — this holds regardless of `strict` mode (object-literal completeness is not gated by `strictNullChecks`). `Partial<Record<...>>` is the correct minimal fix. The fallbacks the plan relies on are confirmed live: `moduleLabel` returns `MODULE_LABELS[type] ?? type` (`moduleMeta.ts:19`) and `ModuleBadge` uses `MODULE_STYLES[type] ?? 'bg-gray-100 …'` (`ModuleBadge.tsx:9`). Correctly ordered as dependent on Task 1.
- **Task 3** — Line 37 in `SessionsPage/index.tsx` is verified byte-for-byte: `const sessions = data?.pages.flatMap((p) => p.items) ?? [];`. Appending `.filter((s) => s.activityType !== 'root')` places the guard upstream of every consumer — `visibleSessions` (line 40), `selectedSession = sessions.find(...)` (line 45), and the empty-state count `sessions.length > 0` (line 49) — so a leaked root row is excluded from selection, filtering, and counting consistently. No other exhaustive `switch`/`Record` over `activityType` exists (grep confirms only `=== 'breath'` narrowing checks in `SessionList.tsx` and `SessionCharts.tsx`, which are unaffected).

### Observations (non-blocking, no action required)

- `FilterValue = 'all' | ActivityType` (`ModuleFilter.tsx:3`) will structurally gain `'root'` after Task 1. No runtime path can set the filter to `'root'` because `TABS` renders only All/Breath/Meditation, and the plan explicitly forbids adding a tab. This is acknowledged in spec note 45 and is harmless — flagged only for completeness.
- The `?? type` / gray-style fallbacks become genuinely reachable code once `root` is a valid `ActivityType` that the maps omit — a strict improvement in honesty over the current dead-fallback state. The plan's "zero visual change" claim holds because `/sessions/runs` still excludes root server-side (`sessions.service.ts:91`), so the filter drops nothing today.

### Positive Notes

- No migrations, endpoints, or API changes involved — correctly scoped as a frontend type/guard reconciliation.
- Task dependencies (2 and 3 depend on 1) are explicit and correct.
- Scope boundaries are tightly pinned: explicit "do NOT" list (no `rootSessionId`, no `endedAt` widening, no `root` tab) prevents the implementer from over-reaching into the unimplemented linked-session model.
- Verification steps (`typecheck` + `build` clean, identical render) are appropriate and sufficient for a compile-only + defensive-guard change; the "Testing: no" setting is justified since there is no silent-failure surface — the whole change is compile-checked or a no-op at runtime today.

PLAN_REVIEW_PASS
