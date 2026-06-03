# Plan Review: Fix InstructionDto field names

**Plan:** `29-fix-instructiondto-field-names.md`
**Files Reviewed:** 5 (plan + 4 codebase files) + 3 mind_api source/doc files for contract verification
**Risk Level:** 🟢 Low

## Verification Summary

The core premise of the plan is **fully verified against the authoritative source** (`mind_api`):

- `mind_api/src/sessions/sessions.service.ts:232-234` documents the exact write-path shape the endpoint returns verbatim: `{ timestamp: number, moduleId: string, instructionType: string, data: unknown }`. The plan's target shape matches this precisely.
- `mind_api/src/realtime/module-instruction-stream.grpc.controller.ts:110-115` confirms the field names `timestamp` (numeric, via `Number(msg.timestamp)`), `moduleId`, `instructionType`, `data`.
- `mind_api/docs/realtime/instruction-model.md:15-43` confirms the discriminator value `breath_phase` and the `data` shape `{ phase, durationMs }` for breath instructions, written by the client.

The bug is real and correctly diagnosed: the current `parsePhases` filters on `i.type === 'breath_phase'`, but the API delivers `instructionType`, so `i.type` is always `undefined` → the breath-phase filter yields an empty set → no instruction grid renders (`hasPhases` is false in `chartOption.ts:99,118`).

## Line / Path Accuracy

All file paths and line references in the plan are accurate:

- `src/core/types/index.ts:36-43` — `InstructionDto` interface, exactly as described.
- `src/pages/SessionsPage/transforms.ts:4` — `secFromStart` signature.
- `transforms.ts:18` — `.filter((i) => i.type === 'breath_phase')`.
- `transforms.ts:30` — `event.payload.phase ?? 'rest'`.
- `chartOption.ts` and `SessionCharts.tsx` pass `InstructionDto[]` through without touching `.type`/`.payload`/`.timestamp` — Task 3's assumption is correct; a full grep confirms `transforms.ts` is the **only** direct field-access consumer.

## Correctness of the Proposed Fix

- **Task 1** (type rename) is correct and complete. The `data: { phase?: BreathPhase; durationMs?: number } & Record<string, unknown>` intersection mirrors the existing `payload` pattern, so no new type-resolution surprises.
- **Task 2** correctly handles the secondary consequence of `timestamp: string → number`: `secFromStart` is called at `transforms.ts:22` and `:25` with `event.timestamp` / `nextEvent.timestamp` (now `number`) and at `:26` with `endedAt` (still `string` from `SessionRun`). Broadening the signature to `(ts: string | number, ...)` keeps both call sites type-valid, and `new Date(ts)` accepts both at runtime. This is the right minimal change.
- **Task 3** is a verification-only step; well scoped.

## Context Gates

- **Architecture (PASS):** The change stays entirely within `core/types` (the layer whose stated purpose is "shared TypeScript types mirroring mind_api response shapes") and a page-local transform. No dependency-direction or boundary violations. No new `fetch`, storage, or `useQuery`-in-component concerns introduced.
- **Rules (PASS):** No rule touched — no `localStorage` access, no proto edits, no raw `fetch`, components still receive props. All-English content maintained.
- **Roadmap (WARN, non-blocking):** The plan does not reference a `ROADMAP.md` milestone. This is `fix`-class work, so a roadmap linkage line would be ideal, but its absence is not blocking.

## Observations (non-blocking)

- **Latent sibling mismatch, correctly scoped out:** `BioSampleDto.timestamp` is typed `string`, but `sessions.service.ts:161` documents the biometrics write-path as `{ timestamp: number, sampleType, data }` — i.e. the *same* type-vs-runtime mismatch exists for biometrics. It currently "works" only because `new Date(numericMs)` happens to accept the number at runtime in `toSeries` (`transforms.ts:47`). The plan explicitly declares this out of scope (Notes), which is a reasonable scoping decision. Flagging it so it is not forgotten — it is a real follow-up, not a defect in this plan.
- **No tests / migrations needed:** Frontend type-only + transform change; no DB migration, no API change. Correctly reflected in Settings (`Testing: no`).

## Positive Notes

- Root cause is verified against the authoritative contract rather than assumed.
- The cascading type effect (numeric timestamp breaking `secFromStart`'s string signature) was anticipated and handled — a common omission in shape-rename plans.
- Consumer impact analysis is complete and matches a full-codebase grep.
- Single-commit scoping with a clear message is appropriate for one logical change.

The plan is accurate, complete, and low-risk. No missing steps, no wrong assumptions, no incorrect paths or API usage.

PLAN_REVIEW_PASS
