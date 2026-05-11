export default function BillsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      {/* Stat cards skeleton */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-7 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="h-7 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="mt-8 flex items-center gap-3">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/50 px-4 py-2.5">
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
