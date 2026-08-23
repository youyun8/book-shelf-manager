import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown while the library loads, matching the grid's shape. */
export function BookGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="書庫載入中">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
