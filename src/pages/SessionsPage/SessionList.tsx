import { Link } from 'react-router-dom';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ModuleBadge } from '@/components/ModuleBadge';
import type { SessionRun } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';

interface SessionListProps {
  sessions: SessionRun[];
  selectedId?: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  emptyMessage?: string;
}

export function SessionList({
  sessions,
  selectedId,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  emptyMessage,
}: SessionListProps) {
  if (isLoading) {
    return <SkeletonLoader rows={6} />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6">
        <span className="text-sm text-gray-400">{emptyMessage ?? 'No sessions yet'}</span>
        {hasNextPage && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="w-full py-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sessions.map((session) => {
        const isSelected = session.id === selectedId;
        return (
          <Link
            key={session.id}
            to={`/sessions/${session.id}`}
            className={[
              'flex flex-col border-l-2 px-4 py-3 transition-colors',
              isSelected
                ? 'border-blue-500 bg-gray-100'
                : 'border-transparent hover:bg-gray-50',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                {session.description ?? (session.activityType === 'breath' ? 'Breath' : 'Meditation')}
              </span>
              <span className="shrink-0">
                <ModuleBadge type={session.activityType} />
              </span>
            </div>
            <span className="mt-0.5 text-xs text-gray-400">
              {formatDate(session.startedAt)} · {formatDuration(session.durationSeconds)}
              {session.activityType === 'breath' && session.complexity != null
                ? ` · Difficulty ${session.complexity.toFixed(1)}`
                : null}
            </span>
          </Link>
        );
      })}

      {hasNextPage && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="w-full py-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
