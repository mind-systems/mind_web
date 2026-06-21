import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ModuleBadge } from '@/components/ModuleBadge';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import type { SessionRun } from '@/core/types';
import { formatDate, formatDuration } from '@/core/format';
import { sessionTitle } from './sessionTitle';

interface SessionListProps {
  sessions: SessionRun[];
  selectedId?: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  emptyMessage?: string;
  onDelete: (id: string) => Promise<unknown>;
  isDeleting: boolean;
  deleteError?: string | null;
  onDeleteErrorReset?: () => void;
}

export function SessionList({
  sessions,
  selectedId,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  emptyMessage,
  onDelete,
  isDeleting,
  deleteError,
  onDeleteErrorReset,
}: SessionListProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!confirmId) return;
    try {
      await onDelete(confirmId);
      setConfirmId(null);
    } catch {
      // leave dialog open; error is surfaced via deleteError prop
    }
  };

  if (isLoading) {
    return <SkeletonLoader rows={6} />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
        <span className="text-sm text-gray-400 dark:text-gray-500">{emptyMessage ?? 'No sessions yet'}</span>
        {hasNextPage && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="w-full py-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-900"
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
          <div
            key={session.id}
            className={[
              'group relative flex flex-col border-l-2 transition-colors',
              isSelected
                ? 'border-blue-500 bg-gray-100 dark:bg-gray-800'
                : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900',
            ].join(' ')}
          >
            {/* Stretched link — whole-card click target */}
            <Link
              to={`/sessions/${session.id}`}
              className="absolute inset-0 z-0"
              aria-label={sessionTitle(session)}
            />

            {/* Text content — pointer-events-none so clicks fall through to the Link */}
            <div className="pointer-events-none px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {sessionTitle(session)}
                </span>
                <span className="shrink-0">
                  <ModuleBadge type={session.activityType} />
                </span>
              </div>
              <span className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {formatDate(session.startedAt)} · {formatDuration(session.durationSeconds)}
                {session.activityType === 'breath' && session.complexity != null
                  ? ` · Difficulty ${session.complexity.toFixed(1)}`
                  : null}
              </span>
            </div>

            {/* Hover-revealed trash button — only for finalized sessions */}
            {session.endedAt != null && (
              <button
                type="button"
                aria-label="Delete session"
                className={[
                  'absolute right-2 top-2 z-10 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100',
                  isSelected ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900',
                ].join(' ')}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmId(session.id);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {hasNextPage && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="w-full py-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-900"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}

      <DeleteConfirmDialog
        open={confirmId !== null}
        isPending={isDeleting}
        errorMessage={deleteError}
        onConfirm={handleConfirm}
        onCancel={() => {
          setConfirmId(null);
          onDeleteErrorReset?.();
        }}
      />
    </div>
  );
}
