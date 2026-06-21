import type { InstructionDto, BioSampleDto, PhaseBar } from '@/core/types';

/** Returns seconds elapsed from `startedAt` to `ts`. */
export function secFromStart(ts: string | number, startedAt: string): number {
  return (new Date(ts).getTime() - new Date(startedAt).getTime()) / 1000;
}

/**
 * Converts breath_phase instructions into non-overlapping PhaseBar intervals.
 * Each bar starts at its instruction `offsetMs` (monotonic ms from session start) and
 * ends at the next instruction's `offsetMs`. The last bar ends at `endedAt − startedAt`
 * (the axis-length scalar). Non-breath_phase instructions are ignored.
 */
export function parsePhases(
  instructions: InstructionDto[],
  startedAt: string,
  endedAt: string,
): PhaseBar[] {
  const breathEvents = instructions.filter((i) => i.instructionType === 'breath_phase');
  if (breathEvents.length === 0) return [];

  return breathEvents.map((event, idx) => {
    const startSec = (event.data.offsetMs ?? 0) / 1000;
    const nextEvent = breathEvents[idx + 1];
    const endSec = nextEvent
      ? (nextEvent.data.offsetMs ?? 0) / 1000
      : secFromStart(endedAt, startedAt);
    return {
      startSec,
      endSec,
      phase: event.data.phase ?? 'rest',
    } satisfies PhaseBar;
  });
}

/**
 * Converts pre-filtered `samples` (already scoped to a single sampleType) to
 * `[secondsFromStart, value]` pairs. Only samples where `data[field]` is a number
 * are included. `startMs` is the session start in ms.
 *
 * The input `samples` are already globally time-sorted — `useBiometricChunks`
 * keeps the accumulated `biometrics` array sorted ascending by timestamp via
 * merge-insert on each chunk arrival. A per-field filtered projection of a
 * globally sorted source is itself sorted, so no additional sort is needed here.
 */
export function toSeries(
  samples: BioSampleDto[],
  field: string,
  startMs: number,
): [number, number][] {
  return samples
    .filter((s) => typeof s.data[field] === 'number')
    .map((s) => [(new Date(s.timestamp).getTime() - startMs) / 1000, s.data[field] as number] as [number, number]);
}
