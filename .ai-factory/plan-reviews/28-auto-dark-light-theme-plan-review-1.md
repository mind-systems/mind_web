# Plan Review: Auto dark/light theme (28)

**Plan:** `.ai-factory/plans/28-auto-dark-light-theme.md`
**Files cross-checked:** `tailwind.config.js`, `src/components/EChart/index.tsx`, `moduleMeta.ts`, `ModuleBadge.tsx`, `SkeletonLoader.tsx`, `PageHeader.tsx`, all `pages/**`, `index.html`, `index.css`, `package.json`
**Risk Level:** 🔴 High — two correctness gaps would ship a broken dark mode if the plan is implemented literally.

## Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`): ✅ PASS. The plan stays inside the feature-module + shared-component boundaries. No new cross-layer dependencies, no storage access added, no `useQuery` pushed into components. Tailwind-only styling change is consistent with the pattern.
- **Rules** (project `CLAUDE.md` rules): ✅ PASS. No `mind_auth_token` rename, no raw `fetch`, no new storage access, English-only. The `EChartProps` interface is explicitly left unchanged (good — keeps call sites stable).
- **Roadmap** (`.ai-factory/ROADMAP.md`): ✅ PASS. Directly implements the `Auto dark/light theme` milestone (line 77). Approach (media darkMode, ECharts theme via `init`, 13-file `dark:` sweep) matches the roadmap entry and references the same spec note.

## Critical Issues

### C1. ECharts `setOption` will NOT re-run after theme re-init → blank chart on OS theme switch (Task 2)

The plan states:

> "...add `isDark` to its dependency array so the existing dispose/re-init cleanup re-creates the chart when the OS theme changes; keep the `ResizeObserver` setup and the separate `setOption` effect intact (**the option effect re-applies after re-init, restoring chart state**)."

This assumption is **wrong**. The two effects in `EChart/index.tsx` are independent:

```ts
useEffect(() => { /* init + ResizeObserver */ }, []);          // → becomes [isDark]
useEffect(() => { chartRef.current?.setOption(option, ...) }, [option, notMerge]);
```

When `isDark` flips, React re-runs the **init** effect (dispose old chart, create new one with the `'dark'` theme). It does **not** re-run the **option** effect, because `[option, notMerge]` are unchanged (`option` is a stable `useMemo` value in both `SessionCharts` and `CalibrationChart`). React effects fire only when their own deps change — one effect re-running never triggers another. Result: after an OS theme change the chart re-inits to an **empty canvas** and stays blank until the option reference happens to change.

**Fix:** make the option re-apply depend on the chart instance. Simplest correct options:
- Add `isDark` to the `setOption` effect's dependency array too, **or**
- Call `chart.setOption(option, notMerge ?? false)` inside the init effect right after `echarts.init(...)` (requires `option`/`notMerge` in the init deps), **or**
- Merge the two effects.

The plan must specify one of these explicitly; "keep the setOption effect intact" as written produces the bug.

### C2. The app shell has no background class to map — dark mode leaves a white shell (Tasks 5, 7, 8)

The plan's strategy is "convert each existing light class to its `dark:` variant" (the mapping table). But several shell surfaces have **no background class at all** — they render transparent over the browser-default white `<body>` (`index.html` and `index.css` set no background). A literal "apply the mapping" pass adds nothing to them, so in dark mode they stay white under dark text:

- `SessionsPage/index.tsx` root: `flex h-screen flex-col overflow-hidden` — no `bg-*`.
- `CalibrationPage/index.tsx` root: `flex h-screen flex-col overflow-hidden` — no `bg-*`.
- `PageHeader.tsx`: `border-b border-gray-200 px-6 py-4` — no surface `bg-*` (Task 5 says "nav bar surface" but there is no surface class to convert).
- `SessionsPage` right "Select a session" panel and `SessionList` rows — transparent, rely on an ancestor that is itself transparent.

Because nothing sets a base background, `dark:bg-*` mapping has nothing to attach to for these containers. **Fix:** the plan must explicitly *add* base + dark backgrounds rather than only rewriting existing classes — e.g. add `bg-gray-50 dark:bg-gray-950` to the page roots, `bg-white dark:bg-gray-900` to `PageHeader`, and/or set a global default in `index.css`:

```css
body { @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100; }
```

A global body rule is the cleanest backstop (also fixes overscroll/scrollbar gutter showing white). Recommend also adding `:root { color-scheme: light dark; }` (or `<meta name="color-scheme" content="light dark">`) so native scrollbars/form chrome follow the theme. As written, Tasks 5/7/8 do not cover these no-background containers and dark mode will look broken for the authenticated shell.

## Medium Issues

### M1. Tailwind v3 default `darkMode` is already `media` (Task 1)

Installed `tailwindcss@^3.4.19`. In Tailwind v3, when `darkMode` is unset the default **is** `'media'`, so `dark:` variants already resolve from `prefers-color-scheme` without Task 1. Adding `darkMode: 'media'` is harmless and makes intent explicit (fine to keep), but the plan presents it as the enabling step ("This makes every `dark:` variant resolve…"), which slightly overstates its effect. Not blocking — just don't expect behavior to change from Task 1 alone.

### M2. CalibrationChart sub-elements excluded from the sweep (Task 8)

Task 8 scopes `CalibrationChart.tsx` to "the section container surface **only**", but the file also has light-only classes that will look wrong in dark mode:
- `text-gray-800` on the device serial,
- the valid-count pill: `bg-gray-100 ... text-gray-500`.

These won't get dark variants under the current scoping, leaving a light-gray pill and near-black text on a dark surface. Recommend widening Task 8 to include these two elements (maps cleanly: `bg-gray-100 → dark:bg-gray-800`, `text-gray-800 → dark:text-gray-200`, `text-gray-500 → dark:text-gray-400`).

### M3. ECharts built-in `'dark'` theme paints its own dark-navy background (Task 2)

`echarts.init(el, 'dark')` applies the bundled dark theme whose `backgroundColor` is `#100C2A` (dark navy), which will not match the `gray-900/950` page surfaces — producing a visible navy rectangle inside each chart panel. The full `import * as echarts` does register the `'dark'` theme (so the call works), but the plan should set `backgroundColor: 'transparent'` in the chart option (or in a small custom theme) so charts blend with the surrounding surface. Worth calling out explicitly in Task 2.

## Minor / Notes

- `EChart`'s `matchMedia('change')` listener (Task 2) is correct on modern browsers; `addEventListener('change', …)` + matching `removeEventListener` cleanup is the right API (legacy `addListener` not needed for current targets). Good that the plan isolates it in its own effect.
- Docs in CLAUDE.md describe React 18, but the project runs React 19 (`react@^19.2.6`). No impact on this plan (effect semantics unchanged), just noting the doc/stack drift.
- File paths in all tasks are accurate and the files exist as referenced. The `chartOption.ts` / `transforms.ts` / `sessionTitle.ts` "do not touch" exclusions are correct — those carry no Tailwind classes.
- Commit plan is coherent and matches the project's no-prefix commit convention.

## Positive Notes

- Correctly identifies that ECharts is canvas-based and cannot inherit CSS `dark:` classes — the core insight most theme plans miss.
- Leaving `EChartProps` and call sites untouched keeps the change contained and matches the architecture's component contract.
- Centralized, consistent color-mapping table makes the page sweep mechanical and reviewable.
- Correctly excludes blue accent classes (readable on both themes) instead of over-editing.

## Required before PLAN_REVIEW_PASS

1. Fix C1 — specify how `setOption` re-applies after theme re-init (add chart-instance/`isDark` dep or setOption inside init effect).
2. Fix C2 — explicitly add base + dark backgrounds to the no-background shell containers (page roots, `PageHeader`) and/or a global `body` rule in `index.css`; don't rely on mapping classes that don't exist.

(Address M1–M3 as well; C1 and C2 are blocking.)
