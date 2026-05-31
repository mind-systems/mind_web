import type { SessionRun } from '@/core/types';

export function sessionTitle(
  session: Pick<SessionRun, 'description' | 'activityType'>,
): string {
  return session.description ?? (session.activityType === 'breath' ? 'Breath' : 'Meditation');
}
