import type { SessionRun } from '@/core/types';
import { moduleLabel } from '@/components/moduleMeta';

export function sessionTitle(
  session: Pick<SessionRun, 'description' | 'activityType'>,
): string {
  return session.description ?? moduleLabel(session.activityType);
}
