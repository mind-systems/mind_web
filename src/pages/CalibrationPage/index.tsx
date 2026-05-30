import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import type { NfbCalibrationsResponse } from '@/core/types';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { groupByDevice } from './transforms';
import { CalibrationChart } from './CalibrationChart';

export function CalibrationPage() {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['nfb-calibrations'],
      queryFn: ({ pageParam }) =>
        apiFetch<NfbCalibrationsResponse>(`/nfb-calibrations?limit=50&offset=${pageParam}`),
      initialPageParam: 0,
      getNextPageParam: (_lastPage, allPages) => {
        const loadedCount = allPages.reduce((sum, p) => sum + p.records.length, 0);
        const total = allPages[allPages.length - 1]?.total ?? 0;
        return loadedCount < total ? loadedCount : undefined;
      },
    });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allRecords = data?.pages.flatMap((p) => p.records) ?? [];
  const deviceGroups = groupByDevice(allRecords);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PageHeader title="Calibrations" />

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <SkeletonLoader rows={6} />
        ) : isError ? (
          <div className="p-6 text-red-500">Failed to load calibration records.</div>
        ) : deviceGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-400">No calibrations recorded yet</span>
          </div>
        ) : (
          <>
            {deviceGroups.map((group) => (
              <CalibrationChart
                key={group.deviceSerial}
                deviceSerial={group.deviceSerial}
                records={group.records}
                validCount={group.validCount}
              />
            ))}

            <div ref={sentinelRef} className="h-1" />

            {isFetchingNextPage && (
              <div className="py-4 text-center text-sm text-gray-400">Loading…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
