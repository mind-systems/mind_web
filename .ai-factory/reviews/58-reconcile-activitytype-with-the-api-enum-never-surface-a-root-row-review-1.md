# Code Review: Reconcile `ActivityType` with the API enum; never surface a root row

## Scope
Reviewed `git diff HEAD` across the three changed source files:
- `src/core/types/index.ts`
- `src/components/moduleMeta.ts`
- `src/pages/SessionsPage/index.tsx`

Read each file in full plus dependents (`ModuleBadge.tsx`, `ModuleFilter.tsx`).

## Verification performed
- `npm run typecheck` (`tsc --noEmit`) — **passes clean**. This is the load-bearing gate: widening the union without relaxing the two `Record<ActivityType, string>` maps would fail here, and it does not.
- Grepped all `MODULE_LABELS` / `MODULE_STYLES` usages — both are only ever accessed by indexed lookup with a `?? fallback` (`moduleLabel` → `?? type`; `ModuleBadge` → gray style). No `Object.keys`/`Object.entries` iteration that would assume exhaustiveness, so the `Partial` relaxation cannot leave a rendered gap.
- `npm run build` fails with `ReferenceError: CustomEvent is not defined` inside Vite's CLI under Node v18.15 — a **pre-existing environment/toolchain issue unrelated to this diff**, not a code defect.

## Findings

### Correctness
- **`ActivityType` widening** (`src/core/types/index.ts:11`) exactly mirrors the wire enum `breath | meditation | root`. `SessionRun` untouched; no `rootSessionId` / `endedAt` change — matches the spec's explicit non-changes.
- **Partial maps** (`src/components/moduleMeta.ts:3,8`) — `root` intentionally absent; existing fallbacks cover it. No behavior change for `breath`/`meditation`.
- **Root guard** (`src/pages/SessionsPage/index.tsx:37`) — the `.filter((s) => s.activityType !== 'root')` is applied to `sessions` *before* it feeds `visibleSessions`, `selectedSession` (`sessions.find`), and the empty-state count. Correct placement: a leaked root row can never be selected, filtered into a tab, or counted. Since `/runs` excludes root server-side today, it drops nothing currently — zero visual change, as required.

### Type safety of the guard interaction
- `FilterValue = 'all' | ActivityType` now structurally admits `'root'`, but `ModuleFilter`'s `TABS` still renders only All/Breath/Meditation, so `'root'` is never selectable. Even if it were, `visibleSessions` filters `sessions` (already root-free) by equality, yielding an empty list — no crash, no leak. No `root` tab was added, per spec.

### Security
- No security surface touched (read-only dashboard, no auth/storage/HTTP changes).

## Conclusion
The diff is a faithful, minimal implementation of the plan. Typecheck passes; the only build error is an unrelated Node/Vite environment problem. No runtime breakage, no type mismatch, no missed exhaustiveness assumption. No findings.

REVIEW_PASS
