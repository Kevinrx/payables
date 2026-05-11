import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { CsvImporter } from "@/components/csv-importer";

export default function ImportBillsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/bills"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to bills
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-muted">
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import from CSV</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bulk-create bills from a spreadsheet. Each row becomes a draft bill, ready for review.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CsvImporter />
      </div>

      <details className="mt-6 rounded-lg border border-border bg-card text-sm">
        <summary className="cursor-pointer px-4 py-3 font-medium">
          Need a template?
        </summary>
        <div className="border-t border-border px-4 py-3 text-xs">
          <p className="text-muted-foreground">Copy this into a file called <code>bills.csv</code>:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 font-mono text-xs">
{`vendor_name,invoice_number,invoice_date,due_date,total,currency,notes
Acme Cloud Services,ACM-2026-0701,2026-07-01,2026-07-31,1416.47,USD,Net 30
Northwind Logistics,NW-99999,2026-07-05,2026-08-04,1325.48,USD,
Globex Office Supplies,GLX-771500,2026-07-10,2026-08-09,2948.10,USD,PO #4421`}
          </pre>
          <p className="mt-3 text-muted-foreground">
            Required columns: <code>vendor_name</code>, <code>total</code>. The rest are optional.
            New vendor names create new vendors; existing ones (case-insensitive) are reused.
          </p>
        </div>
      </details>
    </div>
  );
}
