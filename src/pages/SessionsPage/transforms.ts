import type { InstructionDto, BioSampleDto, PhaseBar } from '@/core/types';

/** Returns seconds elapsed from `startedAt` to `ts`. */
export function secFromStart(ts: string | number, startedAt: string): number {
  return (new Date(ts).getTime() - new Date(startedAt).getTime()) / 1000;
}

/**
 * Converts breath_phase instructions into non-overlapping PhaseBar intervals.
 * Each bar starts at its instruction timestamp and ends at the next breath_phase
 * timestamp (the last bar ends at `endedAt`). Non-breath_phase instructions are ignored.
 */
export function parsePhases(
  instructions: InstructionDto[],
  startedAt: string,
  endedAt: string,
): PhaseBar[] {
  const breathEvents = instructions.filter((i) => i.instructionType === 'breath_phase');
  if (breathEvents.length === 0) return [];

  return breathEvents.map((event, idx) => {
    const startSec = secFromStart(event.timestamp, startedAt);
    const nextEvent = breathEvents[idx + 1];
    const endSec = nextEvent
      ? secFromStart(nextEvent.timestamp, startedAt)
      : secFromStart(endedAt, startedAt);
    return {
      startSec,
      endSec,
      phase: event.data.phase ?? 'rest',
      durationMs: event.data.durationMs,
    } satisfies PhaseBar;
  });
}

/**
 * Converts pre-filtered `samples` (already scoped to a single sampleType) to
 * `[secondsFromStart, value]` pairs sorted ascending by time. Only samples where
 * `data[field]` is a number are included. `startMs` is the session start in ms.
 *
 * Sorting is required because chunks may arrive out of order (zoom-driven loading),
 * and ECharts `type: 'line'` on a `value` x-axis connects points in array order —
 * without the sort, out-of-order arrival draws backward "tie-back" strokes.
 */
export function toSeries(
  samples: BioSampleDto[],
  field: string,
  startMs: number,
): [number, number][] {
  return samples
    .filter((s) => typeof s.data[field] === 'number')
    .map((s) => [(new Date(s.timestamp).getTime() - startMs) / 1000, s.data[field] as number] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}
