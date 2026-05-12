import Link from "next/link";
import { Download, Plus } from "lucide-react";
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
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Bills</h1>
          <p className="mt-1 text-[13px] text-ink-faint">
            Upload, review, approve, and pay your vendor invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link href="/bills/import" className="btn btn-secondary">
            <Download className="h-3.5 w-3.5" />
            Import CSV
          </Link>
          <Link href="/bills/new" className="btn btn-brand">
            <Plus className="h-3.5 w-3.5" />
            New bill
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <SummaryCards summary={summary} />
      </div>

      <div className="mt-7">
        <BillsTable rows={rows} />
      </div>
    </div>
  );
}
