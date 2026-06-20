# Handoff — breath session first phase (rest) renders empty in the web timeline

## 1. Frame
A completed breath session shows an **empty first phase** in the mind_web session timeline. This was investigated from the mobile + API side: the data is **intact** (the first `rest` phase is in the DB, correctly stamped), and the API returns it faithfully. The remaining bug is on the **web render path** (mind_web) — or a stale view. This handoff hands you the confirmed facts, the exact files, the DB evidence, and a reproduce-then-bisect plan so you don't re-investigate the client/server data layer.

**This is NOT a data-loss regression.** The earlier "first rest phase lost" fixes (mobile readiness-gate, replay-fix, offset-axis, eager-tunnels) work — the rest is captured.

## 2. The session under investigation
- URL: `http://localhost:5173/sessions/8e2978a1-0f3b-4305-81db-07bcb716c66a`
- `8e2978a1-0f3b-4305-81db-07bcb716c66a` is a **moduleSession** id (`module_sessions.id`): `activityType=breath`, `status=completed`, `startedAt=2026-06-20 16:40:33.625`, `endedAt=16:41:49.537`, `activityRefId=c9f4a4ef-...` (the breath template).

## 3. DB evidence (ground truth — data is intact)
Flattened `session_stream_samples.samples` for this moduleSession, in order:

| order | element |
|---|---|
| 1 | `{"data":{"event":"session_started","dataType":"session_event"},"timestamp":1781973633647}` |
| 2 | `{"data":{"phase":"rest","offsetMs":7,"tickCount":15},"moduleId":"breath","instructionType":"breath_phase","timestamp":1781973633118}` ← **the first phase, present and correct** |
| 3 | `{"data":{"phase":"inhale","offsetMs":12658,"tickCount":4},...,"instructionType":"breath_phase"}` |
| … | inhale/exhale alternating, offsetMs increasing |
| last | `{"data":{"event":"session_ended","dataType":"session_event"},...}` |

So the first `rest` exists with `offsetMs:7` (≈ origin), `tickCount:15`, `instructionType:"breath_phase"`. It should draw a bar from ~0.007s to the next phase (inhale at 12.658s).

**Note the timestamp inversion:** the `rest` phase `timestamp` (1781973633118) is ~529 ms *earlier* than `session_started` (1781973633647). This is expected — the mobile stamps a breath phase at its phase-start (offset axis), not at send time. It matters because the API sorts by `timestamp` (see §5).

To re-run the DB check (creds in `mind_api/.env`, host `localhost:5432`, db `mind_awake_database`, user `mind_awake_username`):
```sql
select t.ord, elem->'data' as data, elem->>'instructionType' as type, elem->>'timestamp' as ts
from session_stream_samples sss, jsonb_array_elements(sss.samples) with ordinality as t(elem, ord)
where sss."moduleSessionId" = '8e2978a1-0f3b-4305-81db-07bcb716c66a'
order by sss."flushedAt", t.ord;
```

## 4. Read-first map (web render path — all verified correct on static read)

- `src/pages/SessionsPage/SessionCharts.tsx:37` — fetches **all** instructions in ONE query: `apiFetch<InstructionDto[]>('/sessions/runs/${session.id}/instructions?from=&to=')`. (Only *biometrics* are chunked, not instructions — so the chunk loader is NOT involved in phases.)
- `src/pages/SessionsPage/transforms.ts` → `parsePhases(instructions, startedAt, endedAt)` — `instructions.filter(i => i.instructionType === 'breath_phase')`, then each bar `startSec = data.offsetMs/1000`, `endSec = next breathEvent's offsetMs/1000` (last → `endedAt − startedAt`), `phase = data.phase ?? 'rest'`. The `session_event` samples (no `instructionType`) are correctly excluded. For this session this yields `rest [0.007 → 12.658]` as the **first** bar.
- `src/pages/SessionsPage/chartOption.ts:5` `PHASE_COLORS` — has `rest: '#9E9E9E'` (grey). `:13` `PHASE_LABELS` — has `rest: 'Rest'`. `:287–347` — the custom `phase` renderItem series draws each bar across the instruction grid; tooltip label `${PHASE_LABELS[bar.phase] ?? bar.phase} · ${Math.round(end-start)}s`.
- `src/core/types/index.ts:38` `InstructionDto { timestamp, moduleId, instructionType, data:{phase?, offsetMs?, tickCount?} }`.

**Conclusion from static review:** the rest bar *should* render as a grey "Rest · 13s" bar spanning the first ~12.6 s. Nothing in parse/colors/fetch drops or empties it.

## 5. Backend (mind_api) — verified faithful, no fix expected here
- `src/sessions/sessions.controller.ts:40` `@Get('runs/:id/instructions')` → `sessions.service.ts`.
- `src/sessions/sessions.service.ts:191–261` `listInstructions(...)`: loads `session_stream_samples` `order: { flushedAt: 'ASC' }`, flattens every `row.samples` into `flat[]` (skips malformed, caps at `FLAT_CAP`), then **`flat.sort((a,b) => Number(a.timestamp) - Number(b.timestamp))`** (line 259) and returns. No filtering by phase/type, no field stripping — the `rest` element with `instructionType:"breath_phase"` is returned as-is. Because of the timestamp inversion (§3), `session_started` sorts *after* `rest`; harmless because `parsePhases` filters by `instructionType` before indexing.

## 6. Next step (for the web agent) — reproduce, then bisect
The data and both code paths look correct, so first split "still broken live" from "stale view":

1. **Inspect the actual response the frontend gets.** With the app's auth token, hit `/sessions/runs/8e2978a1-0f3b-4305-81db-07bcb716c66a/instructions?from=<startedAt>&to=<endedAt>` (or log `instructionsData` in `SessionCharts.tsx`). Confirm the `rest`/`offsetMs:7`/`instructionType:"breath_phase"` element is present in the array the React Query receives.
   - **If present** → it's a render-layer issue. Bisect:
     - Log `parsePhases(...)` output — confirm `phases[0] = {startSec:0.007, endSec:12.658, phase:'rest'}`.
     - If `phases[0]` is correct, the bug is in the custom phase `renderItem`/axis in `chartOption.ts:287–347`: check how a bar with `startSec ≈ 0` is anchored on the instruction-grid x-axis (zero-origin clipping, dataIndex→value mapping), and whether the grey `#9E9E9E` rest bar is being perceived as "empty" vs the colored inhale/exhale bars (possible UX expectation, not a defect).
     - Check the initial datazoom window (`zoomRef` starts {0,100}) isn't clipping the first bar.
   - **If absent** → re-open the API path, but the DB shows it's there, so this is unlikely.
2. **Rule out staleness:** the session is `completed`; hard-refresh / clear React Query cache and re-open the URL before deep debugging.

## 7. Likely outcomes (ranked)
1. Render-layer quirk drawing/clipping the first (≈0-origin) bar, or the grey rest bar reading as "empty" → fix in `chartOption.ts` phase series / give `rest` a more distinct style.
2. Stale cached chart view → no code change.
3. (Low) something between the API JSON and `parsePhases` — but the full chain is verified, so check this last.

## 8. Hard rules / conventions
- All generated/edited files in English. Match neighbouring code style.
- Do NOT "fix" this on the mobile or API side — the data is correct there; the fix (if any) is in mind_web rendering.
- If you change phase rendering, keep `session_event` samples excluded from the phase timeline (they have no `instructionType`/`phase`).
