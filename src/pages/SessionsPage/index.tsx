import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiFetch } from '@/core/api/client';
import type { ListRunsResponse } from '@/core/types';
import { PageHeader } from '@/components/PageHeader';
import { SessionList } from './SessionList';
import { SessionCharts } from './SessionCharts';

export function SessionsPage() {
  const { id } = useParams<{ id?: string }>();

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

  // Resolve the selected session from already-loaded pages.
  // MVP limitation: deep-linking to a session not yet loaded in the list is not supported —
  // selectedSession will be undefined until that page is scrolled into view.
  const selectedSession = id ? sessions.find((s) => s.id === id) : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left column */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-gray-200">
        <PageHeader title="Sessions" />
        <div className="flex-1 overflow-y-auto">
          <SessionList
            sessions={sessions}
            selectedId={id}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        {selectedSession ? (
          <SessionCharts session={selectedSession} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-400">
              {id && isLoading ? 'Loading…' : 'Select a session'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
