# Auto Dark/Light Theme

**Date:** 2026-06-02
**Source:** conversation context

## Key Findings

- Set `darkMode: 'media'` in `tailwind.config.js` — OS preference drives all `dark:` variants automatically, no JS toggle needed.
- ECharts charts are canvas-based and don't respond to CSS `dark:` classes — must pass `'dark'` to `echarts.init()` based on `window.matchMedia('(prefers-color-scheme: dark)')` and re-init on OS theme change.
- 14 files need `dark:` variants added; color mapping is consistent and mechanical.

## Details

### tailwind.config.js

```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: { extend: {} },
  plugins: [],
}
```

### EChart wrapper — src/components/EChart/index.tsx

Detect OS preference at init time and subscribe to changes:

```ts
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const chart = echarts.init(divRef.current, mq.matches ? 'dark' : undefined);

const onThemeChange = () => {
  chart.dispose();
  // re-init with new theme — trigger via state or re-run init logic
};
mq.addEventListener('change', onThemeChange);
// cleanup: mq.removeEventListener('change', onThemeChange); chart.dispose();
```

Simplest re-init approach: store `isDark` in a `useState`, subscribe to `mq` change event to update it, pass `isDark` as a dep to the init `useEffect` (which disposes and re-creates the chart). The option `useEffect` runs after, restoring the chart state.

### Color mapping (apply consistently across all UI files)

| Light class | Dark variant |
|---|---|
| `bg-white` | `dark:bg-gray-900` |
| `bg-gray-50` | `dark:bg-gray-950` |
| `bg-gray-100` | `dark:bg-gray-800` |
| `bg-gray-200` | `dark:bg-gray-700` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-800` | `dark:text-gray-200` |
| `text-gray-700` | `dark:text-gray-300` |
| `text-gray-600` | `dark:text-gray-400` |
| `text-gray-500` | `dark:text-gray-400` |
| `text-gray-400` | `dark:text-gray-500` |
| `border-gray-300` | `dark:border-gray-600` |
| `border-gray-200` | `dark:border-gray-700` |
| `border-gray-100` | `dark:border-gray-800` |
| `shadow-md` | `dark:shadow-gray-900/50` |
| Input `bg-white` | `dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500` |

Blue accent (`bg-blue-600`, focus rings) works on both themes — leave as-is.

### ModuleBadge dark variants

Each badge type uses a colored background. Shift to the 800-level in dark:

```ts
const STYLES = {
  breath: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  meditation: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  // fallback
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
```

### SkeletonLoader

Skeleton pulse uses `bg-gray-200 animate-pulse` — add `dark:bg-gray-700`.

### Files to update

| File | Notes |
|---|---|
| `tailwind.config.js` | Add `darkMode: 'media'` |
| `src/components/EChart/index.tsx` | Canvas theme detection + re-init on change |
| `src/pages/LoginPage/index.tsx` | Card, inputs, divider, buttons |
| `src/pages/MagicLinkPage/index.tsx` | Card background |
| `src/pages/GoogleCallbackPage/index.tsx` | Card background |
| `src/pages/SessionsPage/index.tsx` | Layout background |
| `src/pages/SessionsPage/SessionList.tsx` | List rows, selected state, hover |
| `src/pages/SessionsPage/SessionCharts.tsx` | Panel header, empty states |
| `src/pages/SessionsPage/ModuleFilter.tsx` | Segmented control |
| `src/pages/CalibrationPage/index.tsx` | Page background, empty state |
| `src/pages/CalibrationPage/CalibrationChart.tsx` | Section container only |
| `src/components/PageHeader.tsx` | Nav bar, active link |
| `src/components/ModuleBadge.tsx` | Per-type dark variants |
| `src/components/SkeletonLoader.tsx` | Pulse color |

### Verification

- Switch macOS to dark mode → entire UI switches, ECharts charts use dark theme, no white flash.
- Switch back to light → all reverts.
- Charts re-render correctly after OS theme switch (no stale canvas state).
