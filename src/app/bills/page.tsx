import Link from "next/link";
import { Plus } from "lucide-react";
import { getBillSummary, getDemoOrgId, listBills } from "@/db/queries";
import { BillsTable } from "@/components/bills-table";
import { SummaryCards } from "@/components/summary-cards";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const orgId = await getDemoOrgId();
  const [summary, rows] = await Promise.all([
    getBillSummary(orgId),
    listBills(orgId),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload, review, approve, and pay your vendor invoices.
          </p>
        </div>
        <Link
          href="/bills/new"
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New bill
        </Link>
      </div>

      <div className="mt-6">
        <SummaryCards summary={summary} />
      </div>

      <div className="mt-8">
        <BillsTable rows={rows} />
      </div>
    </div>
  );
}
