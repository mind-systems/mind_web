# Code Review (round 2): Auto dark/light theme (28)

**Plan:** `.ai-factory/plans/28-auto-dark-light-theme.md`
**Scope:** `git diff HEAD` / `git status` — 15 source files (same set as round 1), `tailwind.config.js`, `src/index.css`, and the chart data transforms. All read in full.
**Checks:** `npx tsc --noEmit` ✅ clean · `npx eslint src/components/EChart/index.tsx` ✅ clean.

## Round-1 follow-up

**M1 (CalibrationPage charts dispose + re-init on every render) — RESOLVED.** `EChart` was refactored to the recommended two-effect design:

```ts
// src/components/EChart/index.tsx
useEffect(() => { /* init + ResizeObserver */ }, [isDark]);                 // dispose/recreate only on theme switch
useEffect(() => { chartRef.current?.setOption({ backgroundColor: 'transparent', ...(option as object) }, notMerge ?? false); }, [option, notMerge, isDark]);
```

I traced the React effect ordering for the three cases that matter:

- **Mount:** init effect runs first (declaration order) → `chartRef.current` set → setOption effect applies the option. Chart renders populated. ✓
- **OS theme switch (`isDark` flips):** both effects re-run. React runs all cleanups before all setups, in declaration order: init cleanup disposes the old chart and nulls `chartRef`; init setup creates the new dark/light chart and re-sets `chartRef`; setOption setup then applies the option to the fresh canvas. No blank-canvas window — the C1 concern stays fixed under the new structure. ✓
- **`option`-only change (the M1 case — `CalibrationPage` recomputes `groupByDevice` unmemoized every render, so `option` is a new reference each render):** `isDark` is unchanged, so the init effect does **not** re-run; only the setOption effect fires → a cheap `setOption` merge, no dispose/re-init. The per-render canvas teardown is gone. ✓

Secondary observations on the new code, all benign:
- `chartRef` is now genuinely used (written in init, read in setOption) — the round-1 "write-only ref" nit is also gone.
- The setOption effect has no cleanup, which is correct: the chart lifecycle is owned solely by the init effect, and `chartRef.current?.` optional-chains away the disposed/never-initialized window.
- ResizeObserver is `disconnect()`-ed before `chart.dispose()` in the init cleanup, so no resize-after-dispose can fire.

## Other files

No changes since round 1 beyond the `EChart` refactor (diff-stat matches). The remaining edits are className-only `dark:` additions, re-verified:
- Global backstop (`index.css` `@layer base` + `color-scheme: light dark`), tailwind `darkMode: 'media'`, shared components (`PageHeader`, `ModuleBadge`/`moduleMeta`, `SkeletonLoader`), auth pages, and both page modules apply the color mapping consistently; transparent shells get explicit `bg-*`/`dark:bg-*`; blue and `text-red-*` accents correctly left untouched.
- The "do not touch" exclusions (`chartOption.ts`, `transforms.ts`, `sessionTitle.ts`) held — chart colors come from the ECharts theme + transparent background.

## Verdict

The round-1 finding is fixed and the fix is correct under React's effect semantics. No bugs, security issues, type errors, or correctness problems remain. `tsc` and ESLint pass.

REVIEW_PASS
