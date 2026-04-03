export function AnalysisPageSkeleton() {
  const shimmer =
    "animate-pulse rounded-lg bg-bg-secondary";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Verdict Card skeleton */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex-1 space-y-4">
            <div className={`${shimmer} h-9 w-56`} />
            <div className={`${shimmer} h-4 w-36`} />
            <div className={`${shimmer} h-5 w-full max-w-md`} />
            <div className={`${shimmer} h-3 w-44`} />
          </div>
          <div className={`${shimmer} h-[120px] w-[120px] !rounded-full`} />
        </div>
      </div>

      {/* Risk Breakdown skeleton */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <div className={`${shimmer} mb-6 h-4 w-32`} />
        <div className="grid gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="space-y-2">
              <div className="flex justify-between">
                <div className={`${shimmer} h-4 w-28`} />
                <div className={`${shimmer} h-4 w-12`} />
              </div>
              <div className={`${shimmer} h-2 w-full`} />
            </div>
          ))}
        </div>
      </div>

      {/* Legal Reasoning skeleton */}
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8"
        >
          <div className={`${shimmer} mb-4 h-4 w-28`} />
          <div className="space-y-2">
            <div className={`${shimmer} h-4 w-full`} />
            <div className={`${shimmer} h-4 w-5/6`} />
            <div className={`${shimmer} h-4 w-3/4`} />
          </div>
        </div>
      ))}

      {/* Precedents skeleton */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <div className={`${shimmer} mb-6 h-4 w-36`} />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-lg border border-border p-5"
            >
              <div className={`${shimmer} h-4 w-48`} />
              <div className={`${shimmer} mt-3 h-3 w-full`} />
              <div className={`${shimmer} mt-1 h-3 w-2/3`} />
              <div className={`${shimmer} mt-4 h-0.5 w-8`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
