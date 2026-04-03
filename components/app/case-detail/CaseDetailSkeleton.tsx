export function CaseDetailSkeleton() {
  const shimmer = "animate-pulse rounded-lg bg-bg-secondary";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Case info card skeleton */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <div className={`${shimmer} h-3 w-16`} />
            <div className={`${shimmer} h-7 w-64`} />
          </div>
          <div className={`${shimmer} h-7 w-24`} />
        </div>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className={`${shimmer} h-3 w-20`} />
              <div className={`${shimmer} h-4 w-32`} />
            </div>
          ))}
        </div>
      </div>

      {/* Actions skeleton */}
      <div className="flex gap-3">
        <div className={`${shimmer} h-10 w-36`} />
        <div className={`${shimmer} h-10 w-44`} />
      </div>

      {/* Tabs skeleton */}
      <div className={`${shimmer} h-12 w-full rounded-lg`} />

      {/* Content skeleton */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel">
        <div className={`${shimmer} mb-4 h-4 w-28`} />
        <div className="space-y-3">
          <div className={`${shimmer} h-4 w-full`} />
          <div className={`${shimmer} h-4 w-5/6`} />
          <div className={`${shimmer} h-4 w-3/4`} />
        </div>
      </div>
    </div>
  );
}
