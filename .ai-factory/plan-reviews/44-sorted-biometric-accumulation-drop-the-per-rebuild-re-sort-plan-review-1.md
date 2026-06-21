# Plan Review: Sorted biometric accumulation — drop the per-rebuild re-sort

**Plan:** `44-sorted-biometric-accumulation-drop-the-per-rebuild-re-sort.md`
**Files Reviewed:** 4 (plan target files + spec note + consumers)
**Risk Level:** 🟢 Low

## Verdict
The plan is correct, well-scoped, and faithfully implements spec note 29. Every codebase assumption was verified against the live source. No blocking issues found.

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. The change stays within `pages/SessionsPage/`; no boundary or dependency-rule violation. The new helper is a pure function with no storage/network/`console` access. (See "Best Practices" for one soft placement note.)
- **Rules (`rules/base.md` + project CLAUDE.md):** PASS. All files English; no `mind_auth_token`, storage, or raw-`fetch` concerns touched; no proto involvement. Logging stays "minimal" as the plan's Settings declare — the merge is a pure function and adds no log lines.
- **Roadmap (`ROADMAP.md`):** PASS — strong linkage. The plan maps 1:1 onto the open milestone at line 145 (Phase 19, "Sorted biometric accumulation — drop the per-rebuild re-sort", note 29), including the API-owner flag #2 about avoiding naive `appendData`.

## Assumption Verification (all confirmed)

- `useBiometricChunks.ts:113` is exactly `setBiometrics((prev) => [...prev, ...data])` — correct target. ✅
- `transforms.ts:53` is the trailing `.sort((a, b) => a[0] - b[0])` in `toSeries`; doc comment at lines 41–43 justifies it. ✅
- `BioSampleDto.timestamp` is an ISO **string** (`core/types/index.ts:48-52`), so `new Date(s.timestamp).getTime()` is the right key. ✅
- The `useMemo` in `SessionCharts.tsx:95-108` is keyed on `biometrics` identity, so returning a **new** array from the merge correctly triggers a rebuild — the plan's "return a new array, do not mutate `prev`" instruction is necessary and correct. ✅
- **Critical chain holds:** `chartOption.ts:104-111` partitions `biometrics` with a `for...of` + `bucket.push(s)` that preserves global order; `toSeries` only `.filter().map()`s (order-preserving). Therefore a globally time-sorted `biometrics` yields time-sorted per-field series *without* the `.sort()`. The premise behind dropping the sort is sound. ✅
- `toSeries` has no other callers (only `chartOption.ts`), and every source it receives derives from the globally-sorted `biometrics`. Removing the sort cannot break an unrelated path. ✅

## Correctness Notes (non-blocking)

- **Sort invariant is inductively sound.** Reset sets `biometrics = []` (sorted); each step merges a freshly-sorted incoming chunk into a sorted `prev` → result sorted. The functional `setBiometrics((prev) => merge(prev, data))` updater composes correctly even if multiple chunk responses batch. No gap.
- **No duplicate-sample risk.** Per-chunk dedup (`loadedRef` by index) plus half-open `+1 ms` windows (`useBiometricChunks.ts:87-92`) means each sample arrives once; even if duplicates occurred, a two-pointer merge still yields sorted output. Fine.
- The plan correctly preserves the `fetchIdRef` stale-guard ordering and the `loadedRef`/`inFlightRef`/`queuedSetRef` refs byte-for-byte, and keeps `loadedRef.current.add(idx)` after the merge call inside `.then`.

## Best Practices (minor, optional)

- **Helper placement.** The plan puts `mergeSortedByTimestamp` as a module-level helper in `useBiometricChunks.ts`. The repo convention keeps pure data transforms in `transforms.ts` (where `secFromStart`/`parsePhases`/`toSeries` live). Placing it there would be more consistent and testable. Given Testing is off and the helper is tightly coupled to accumulation, the hook file is acceptable — treat as a soft preference, not a required change.
- **Per-comparison `Date` parsing.** A general two-pointer merge will call `new Date(s.timestamp).getTime()` repeatedly during comparisons (O(N) parses per chunk). This is still strictly cheaper than the status quo (20× `toSeries` re-sorts per memo recompute, each re-parsing every sample), so it is a net win and not a concern. If the implementer wants, decorating each side as `{key, sample}` once before merging avoids re-parsing — optional polish only.

## Positive Notes

- Tasks are correctly sequenced with explicit dependencies (Task 2 and 3 depend on Task 1).
- The plan explicitly forbids touching the dedup/stale-guard refs — exactly the fragile area to protect in this hook.
- Task 3 carries the API-owner flag #2 (`appendData` ban) forward as an in-code guard rail, preserving institutional knowledge for the future incremental-update work (note 30).
- Doc-comment update in `toSeries` is included, so the code's justification stays in sync with the new invariant.
- Single-commit scope and manual verification step (jump-zoom → monotonic X) are appropriate for a 3-task perf change.

PLAN_REVIEW_PASS
