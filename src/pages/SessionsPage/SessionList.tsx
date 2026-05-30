import { Link } from 'react-router-dom';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import type { SessionRun } from '@/core/types';
import { formatSessionDate, formatDuration } from './format';

interface SessionListProps {
  sessions: SessionRun[];
  selectedId?: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
}

export function SessionList({
  sessions,
  selectedId,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
}: SessionListProps) {
  if (isLoading) {
    return <SkeletonLoader rows={6} />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <span className="text-sm text-gray-400">No sessions yet</span>
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
            <span className="text-sm font-medium text-gray-900">
              {formatSessionDate(session.startedAt)}
            </span>
            <span className="mt-0.5 text-xs text-gray-400">
              {formatDuration(session.durationSeconds)}
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
