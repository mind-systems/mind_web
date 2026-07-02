import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import type { SessionRun, InstructionDto } from '@/core/types';

// No time window for instructions: on the offset axis a phase's wire timestamp can fall
// outside [startedAt, endedAt] — the first `rest` is stamped ~0.5 s before startedAt
// (origin/tap precedes the server's startedAt), so a `from=startedAt` lower bound makes
// the API drop it. Instructions are tiny (one marker per phase), so the full set is safe
// to fetch unfiltered; the [from, to) window is a biometrics-only (413-avoidance) concern.
export function useChartInstructions(session: SessionRun) {
  return useQuery({
    queryKey: ['session-instructions', session.id],
    queryFn: () =>
      apiFetch<InstructionDto[]>(`/sessions/runs/${session.id}/instructions`),
  });
}
