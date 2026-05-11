export default function BillDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />

      <div className="mt-3 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-3 w-12 ml-auto animate-pulse rounded bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="mt-6 h-9 w-28 animate-pulse rounded-md bg-muted" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={3} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <SectionSkeleton rows={6} tall />
          <SectionSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}

function SectionSkeleton({ rows, tall }: { rows: number; tall?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className={tall ? "p-3" : "p-4"}>
        {tall ? (
          <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="space-y-2.5">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: `${50 + ((i * 17) % 50)}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
