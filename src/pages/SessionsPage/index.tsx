import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '@/core/api/client';
import { useDeleteSession } from './useDeleteSession';
import type { ListRunsResponse } from '@/core/types';
import { PageHeader } from '@/components/PageHeader';
import { SessionList } from './SessionList';
import { SessionCharts } from './SessionCharts';
import { ModuleFilter } from './ModuleFilter';
import type { FilterValue } from './ModuleFilter';

export function SessionsPage() {
  const { id } = useParams<{ id?: string }>();
  const [filter, setFilter] = useState<FilterValue>('all');

  const {
    mutateAsync: deleteSession,
    isPending: isDeleting,
    error: deleteError,
    reset: resetDelete,
  } = useDeleteSession(id);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['session-runs'],
      queryFn: ({ pageParam }) =>
        apiFetch<ListRunsResponse>(`/sessions/runs?limit=50&offset=${pageParam}`),
      initialPageParam: 0,
      getNextPageParam: (_lastPage, allPages) => {
        const loadedCount = allPages.reduce((sum, p) => sum + p.items.length, 0);
        const total = allPages[allPages.length - 1]?.total ?? 0;
        return loadedCount < total ? loadedCount : undefined;
      },
    });

  const sessions = data?.pages.flatMap((p) => p.items) ?? [];

  const visibleSessions =
    filter === 'all' ? sessions : sessions.filter((s) => s.activityType === filter);

  // Resolve the selected session from already-loaded pages.
  // MVP limitation: deep-linking to a session not yet loaded in the list is not supported —
  // selectedSession will be undefined until that page is scrolled into view.
  const selectedSession = id ? sessions.find((s) => s.id === id) : undefined;

  const moduleLabel = filter === 'breath' ? 'Breath' : 'Meditation';
  const emptyMessage =
    filter !== 'all' && sessions.length > 0 && visibleSessions.length === 0
      ? (hasNextPage
          ? `No ${moduleLabel} sessions loaded yet — load more below`
          : `No ${moduleLabel} sessions`)
      : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <PageHeader />

      {/* Content row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-gray-200 dark:border-gray-700">
          <ModuleFilter value={filter} onChange={setFilter} />
          <div className="flex-1 overflow-y-auto">
            <SessionList
              sessions={visibleSessions}
              selectedId={id}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              onLoadMore={() => fetchNextPage()}
              emptyMessage={emptyMessage}
              onDelete={deleteSession}
              isDeleting={isDeleting}
              deleteError={
                deleteError instanceof ApiError
                  ? deleteError.message
                  : deleteError
                    ? 'Something went wrong'
                    : null
              }
              onDeleteErrorReset={resetDelete}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedSession ? (
            <SessionCharts key={selectedSession.id} session={selectedSession} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-gray-400 dark:text-gray-500">
                {id && isLoading ? 'Loading…' : 'Select a session'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
