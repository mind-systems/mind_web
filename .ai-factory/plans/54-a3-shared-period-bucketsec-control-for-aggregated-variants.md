# Plan: (A3) Shared period (`bucketSec`) control for aggregated variants

## Context
Add a TradingView-style manual period control: a single free "seconds" input next to the variant radio group that sets the effective `bucketSec` for all aggregated chart variants (currently only Min/max; future avg/lttb inherit it for free), while Raw ignores it. Empty input = Auto = `computeBucketSec(duration)`, preserving current behavior. Web-only, no API change.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Assumptions
- **No new variants in this milestone.** The milestone text names `avg`/`lttb` to describe the control's intended reach, but the authoritative spec note's "Change" section and the A2 registry guard ("Future avg/lttb radios are appended here one line each — do not add them now") scope A3 to the period-control infrastructure only. Only `minmax` is aggregated today; adding `avg`/`lttb` stays a future one-line registry addition.
- **Commit on blur + Enter (no debounce timer).** The spec allows "debounce OR apply on blur + Enter" — this plan uses blur + Enter to avoid a timer and keep the input purely local UI state (no `localStorage`, per project rule).

## Tasks

### Phase 1: Extend the variant contract and factory

- [x] **Task 1: Extend `ChartVariant` contract with `bucketSec` prop and `aggregated` flag**
  Files: `src/pages/SessionsPage/chartVariants/types.ts`
  Change `Component` prop type from `ComponentType<{ session: SessionRun }>` to `ComponentType<{ session: SessionRun; bucketSec: number | null }>` (`null` = Auto). Add `aggregated: boolean` to the `ChartVariant` interface so the shell can tell whether a variant honors the period control (used to enable/disable the input and to decide whether to derive an effective bucket). Update the JSDoc to note `bucketSec` is ignored by non-aggregated variants.

- [x] **Task 2: Make `makeWindowedVariant` period-aware** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartVariants/makeWindowedVariant.tsx`
  - Add `aggregated: boolean` to `WindowedVariantConfig`.
  - Change `windowSec` and `buildPath` in the config to also receive the effective bucket seconds: `windowSec: (session, effBucketSec) => number` and `buildPath: (session, effBucketSec) => (fromMs, toMs) => string`. For non-aggregated (raw) variants `effBucketSec` is `null` and unused.
  - In `Component`, accept the new `bucketSec: number | null` prop. Compute `effBucketSec = config.aggregated ? (bucketSec ?? computeBucketSec(session.durationSeconds)) : null` (import `computeBucketSec` from `../bucketPolicy`). Pass `effBucketSec` into `config.windowSec(session, effBucketSec)` and `config.buildPath(session, effBucketSec)`.
  - Add `effBucketSec` to the `windowSec`/`buildPath` `useMemo` dependency arrays (correctness; the remount key in Task 5 already guarantees a fresh mount per period, so this is belt-and-suspenders — keep the existing eslint-disable comment style).
  - Return `aggregated: config.aggregated` alongside `id`, `label`, `Component` so the object satisfies the extended `ChartVariant` contract.
  - No change to `useBiometricWindows`: when the period changes, `windowSec` changes → `totalWindows` changes → the loader's `[session.id, totalWindows]` reset fires; and for periods that yield the same `totalWindows`, the Task 5 remount key forces a clean reload regardless.

- [x] **Task 3: Update the registry — mark variants aggregated and thread `effBucketSec`** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartVariants/registry.ts`
  - `rawVariant`: add `aggregated: false`. Its `windowSec`/`buildPath` signatures gain the (ignored) `effBucketSec` param; behavior unchanged (`windowSec: () => 30`, raw `?from&to` path).
  - `minmaxVariant`: add `aggregated: true`. Replace the two internal `computeBucketSec(session.durationSeconds)` calls with the injected `effBucketSec`: `windowSec: (session, effBucketSec) => { const raw = Math.ceil(session.durationSeconds / 8); return Math.max(Math.ceil(raw / effBucketSec) * effBucketSec, effBucketSec); }` and `buildPath: (session, effBucketSec) => (fromMs, toMs) => …&bucketSec=${effBucketSec}` (keep the existing absolute-grid `qFrom`/`qTo` quantization, using `effBucketSec * 1000` as the step). Keep `DEFAULT_VARIANT_ID = 'minmax'` and the "do not add avg/lttb now" comment.

### Phase 2: Shell-owned period state and input

- [x] **Task 4: Add the presentational `PeriodInput` component**
  Files: `src/pages/SessionsPage/PeriodInput.tsx` (new)
  A controlled numeric "seconds" field, styled to sit inline in the header next to `VariantSelector`. Props: `{ value: number | null; maxSec: number; disabled: boolean; onCommit: (next: number | null) => void }`. Behavior:
  - Keep a local draft string in `useState` (local UI state only — no `localStorage`). Sync the draft from `value` when `value` changes (e.g. via `useEffect`) so external resets reflect.
  - Label "Period, s"; `placeholder="Auto"`. Render `<input type="number" min={1} step={1}>` (or text with numeric parsing).
  - Commit on blur and on Enter keydown — NOT per keystroke. On commit: trim; empty ⇒ `onCommit(null)` (Auto). Otherwise parse a positive integer; if `NaN` or `< 1`, revert the draft to `value` and do not commit; if valid, clamp to `[1, maxSec]` and `onCommit(clamped)`.
  - When `disabled`, render the field visually greyed and non-interactive (`disabled` attribute) but keep showing `value`.
  Purely presentational: no fetching, no query, no session knowledge beyond the `maxSec`/`value` props passed by the shell.

- [x] **Task 5: Wire the period control into `SessionCharts`** (depends on Task 3, Task 4)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  - Add `const [periodSec, setPeriodSec] = useState<number | null>(null)` (`null` = Auto). No `localStorage`.
  - Render `<PeriodInput>` next to `<VariantSelector>` in the header, passing `value={periodSec}`, `maxSec={session.durationSeconds}`, `onCommit={setPeriodSec}`, and `disabled={!variant.aggregated}` (Raw active ⇒ disabled). Note `periodSec` is intentionally NOT reset when switching variants — switching algorithm keeps the period.
  - Pass `bucketSec={periodSec}` into the active variant: `<V session={session} bucketSec={periodSec} key={…} />`.
  - Extend the remount `key` to include the period: `key={`${session.id}:${selectedId}:${periodSec ?? 'auto'}`}` so a period change reloads the windowed loader even when two periods produce the same `totalWindows`.

## Commit Plan
- **Commit 1** (after tasks 1-3): "Make chart variant contract period-aware for aggregated variants"
- **Commit 2** (after tasks 4-5): "Add shared period input to the session chart shell"
</content>
</invoke>
