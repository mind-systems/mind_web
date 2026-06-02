# Code Review: Auto dark/light theme (28)

**Plan:** `.ai-factory/plans/28-auto-dark-light-theme.md`
**Scope reviewed:** `git diff HEAD` — all 15 source files (read in full), plus `tailwind.config.js`, `src/index.css`, and the data transform feeding the charts.
**Checks:** `npx tsc --noEmit` ✅ clean · `npx eslint src/components/EChart/index.tsx` ✅ clean.

The dark-mode sweep is faithful to the (twice-reviewed) plan: the C1 fix (option applied inside the init effect), the C2 fix (global `body` backstop + explicit per-surface backgrounds on the transparent shells), M2 (CalibrationChart sub-elements), and M3 (`backgroundColor: 'transparent'`) are all present and correct. Color mapping is applied consistently and the blue/red accents are correctly left untouched. One behavioral regression is worth fixing before merge; everything else is minor.

## Medium

### M1. CalibrationPage charts dispose + re-init on *every* render (perf/flicker regression)

`EChart`'s init effect now lists `option` in its dependency array:

```ts
// src/components/EChart/index.tsx:41
}, [isDark, option, notMerge]);
```

So whenever the `option` **reference** changes, the chart is fully disposed and re-`init()`ed (canvas torn down and rebuilt), not just updated via `setOption`. That is fine for `SessionCharts`, where `option` is `useMemo`'d on React-Query data references that are stable across renders.

It is **not** fine for `CalibrationChart`. In `CalibrationPage` the groups are recomputed on every render with no memo:

```ts
// src/pages/CalibrationPage/index.tsx:43-44
const allRecords = data?.pages.flatMap((p) => p.records) ?? [];
const deviceGroups = groupByDevice(allRecords);
```

`groupByDevice` always returns fresh arrays (`[...recs].sort(...)`, `transforms.ts:26`), so each render hands `CalibrationChart` a new `records` reference → its `useMemo(..., [records])` recomputes → a new `option` reference → the `EChart` init effect re-runs → **dispose + re-init of every visible chart on every render**.

`CalibrationPage` re-renders on routine events: each infinite-scroll page (`isFetchingNextPage` toggles, new records appended) and React-Query background refetches. With one chart per device, the user scrolling the calibrations list will see all charts tear down and rebuild repeatedly (blank frame / animation replay). Before this change, an `option` change only triggered a cheap `setOption` merge on the existing canvas, so this is a regression introduced by moving `option` into the init deps.

**Fix — pick one:**

- *Defensive, preferred (fixes it for all callers):* split `EChart` back into two effects — init keyed on `[isDark]` only, and a separate `setOption` effect keyed on `[option, notMerge, isDark]`. Because the init effect is declared first, on an `isDark` change it disposes/recreates and then the option effect re-applies in the same commit; on an `option`-only change just the cheap `setOption` runs. This removes the dependency on every caller memoizing `option` perfectly.
- *Local:* memoize the groups so the `records` reference is stable across renders, e.g. `const deviceGroups = useMemo(() => groupByDevice(data?.pages.flatMap((p) => p.records) ?? []), [data]);` in `CalibrationPage`.

## Minor / Nits

- **`chartRef` is now write-only.** With the standalone `setOption` effect removed, `chartRef.current` is assigned and nulled but never read (`EChart/index.tsx:13,28,39`). Harmless, but the `useRef` can be dropped if you keep the single-effect design; if you adopt the two-effect fix above, `chartRef` becomes meaningful again.
- **Loss of chart transition animation on data change.** Even in the stable-`option` case (SessionsPage), switching sessions now disposes/recreates the chart instead of animating via `setOption(..., notMerge)`. Behaviorally fine for this read-only dashboard; noting it as an intentional consequence of the chosen approach.

## Positive Notes

- C1 correctly resolved: `chart.setOption(...)` runs inside the init effect, so the chart is never left blank after an OS theme switch — and the runtime `change` subscription drives `isDark` cleanly with matching `removeEventListener` cleanup.
- C2 fully addressed: the `@layer base` `body` backstop plus `color-scheme: light dark` covers overscroll/native chrome, and the previously-transparent shells (`SessionsPage`/`CalibrationPage` roots, `PageHeader`) get explicit `bg-* dark:bg-*` rather than no-op variant rewrites.
- M3 handled at the wrapper via a shallow merge that lets a caller's own `backgroundColor` win, so `chartOption.ts` builders stayed untouched as planned.
- `tsc` and ESLint pass; the `{ backgroundColor, ...(option as object) }` spread typechecks against `setOption` without suppressions.

(M1 is the only item that affects runtime behavior; addressing it — ideally via the two-effect split — is recommended before merge. No security or type-safety issues found.)
