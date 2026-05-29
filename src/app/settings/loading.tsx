export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <div>
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
          >
            <div className="h-8 w-8 flex-none animate-pulse rounded-lg bg-muted" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-64 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-4 w-4 flex-none animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
