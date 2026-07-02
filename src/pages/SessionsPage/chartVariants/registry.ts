import { makeWindowedVariant } from './makeWindowedVariant';
import type { ChartVariant } from './types';

function enc(ms: number): string {
  return encodeURIComponent(new Date(ms).toISOString());
}

const rawVariant = makeWindowedVariant({
  id: 'raw',
  label: 'Raw',
  aggregated: false,
  windowSec: () => 30,
  buildPath: (session) => (fromMs, toMs) =>
    `/sessions/runs/${session.id}/biometrics?from=${enc(fromMs)}&to=${enc(toMs)}`,
});

const minmaxVariant = makeWindowedVariant({
  id: 'minmax',
  label: 'Min/max',
  aggregated: true,
  windowSec: (session, effBucketSec) => {
    const bucketSec = effBucketSec as number;
    // Target ~8 windows: snap ceil(durationSeconds / 8) up to the nearest multiple of
    // bucketSec so window edges sit on the bucket ladder (no window narrower than one bucket).
    const raw = Math.ceil(session.durationSeconds / 8);
    return Math.max(Math.ceil(raw / bucketSec) * bucketSec, bucketSec);
  },
  buildPath: (session, effBucketSec) => {
    const bucketSec = effBucketSec as number;
    const sessionEndMs = new Date(session.endedAt).getTime();
    // Quantizes raw [fromMs, toMs] ranges onto the absolute bucket grid:
    // - floor interior boundaries so window i's qTo equals window i+1's qFrom
    //   (contiguous, non-overlapping under [from, to) server semantics)
    // - ceil only the final window so the session's last partial bucket is not dropped
    return (fromMs: number, toMs: number) => {
      const step = bucketSec * 1000;
      const qFrom = Math.floor(fromMs / step) * step;
      const qTo =
        toMs >= sessionEndMs ? Math.ceil(toMs / step) * step : Math.floor(toMs / step) * step;
      return `/sessions/runs/${session.id}/biometrics?from=${enc(qFrom)}&to=${enc(qTo)}&bucketSec=${bucketSec}`;
    };
  },
});

// Future avg/lttb radios are appended here one line each — do not add them now.
export const CHART_VARIANTS: ChartVariant[] = [rawVariant, minmaxVariant];

export const DEFAULT_VARIANT_ID = 'minmax';
