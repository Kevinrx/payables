import Link from "next/link";
import { Inbox } from "lucide-react";

export function BillsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-paper-sunken text-ink-faint">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium">
        {hasFilters ? "No bills match your filters" : "No bills yet"}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-ink-faint">
        {hasFilters
          ? "Try clearing the search or status filter."
          : "Upload an invoice to get started — we'll extract the details with AI."}
      </p>
      {!hasFilters && (
        <Link href="/bills/new" className="btn btn-brand mt-4">
          Upload your first invoice
        </Link>
      )}
    </div>
  );
}
