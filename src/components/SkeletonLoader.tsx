interface SkeletonLoaderProps {
  rows?: number;
}

export function SkeletonLoader({ rows = 6 }: SkeletonLoaderProps) {
  return (
    <div className="flex flex-col gap-1 p-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-md px-3 py-3">
          <div className="mb-2 h-3.5 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/4 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
