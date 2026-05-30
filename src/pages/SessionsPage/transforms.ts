import type { InstructionDto, BioSampleDto, PhaseBar } from '@/core/types';

/** Returns seconds elapsed from `startedAt` to `ts`. */
export function secFromStart(ts: string, startedAt: string): number {
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
  const breathEvents = instructions.filter((i) => i.type === 'breath_phase');
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
      phase: event.payload.phase ?? 'rest',
    } satisfies PhaseBar;
  });
}

/**
 * Filters `samples` by `sampleType`, picks `data[field]` (numbers only), and
 * returns an array of `[secondsFromStart, value]` pairs.
 */
export function toSeries(
  samples: BioSampleDto[],
  sampleType: string,
  field: string,
  startedAt: string,
): [number, number][] {
  return samples
    .filter((s) => s.sampleType === sampleType)
    .filter((s) => typeof s.data[field] === 'number')
    .map((s) => [secFromStart(s.timestamp, startedAt), s.data[field] as number]);
}
