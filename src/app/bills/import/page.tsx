import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Sparkles } from "lucide-react";
import { CsvImporter } from "@/components/csv-importer";

export default function ImportBillsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <Link href="/bills" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to bills
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-md"
          style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
        >
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Import from CSV</h1>
          <p className="mt-0.5 text-[13px] text-ink-faint">
            Bulk-create bills from a spreadsheet. Each row becomes a draft bill, ready for review.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CsvImporter />
      </div>

      <div
        className="mt-5 flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px]"
        style={{ background: "var(--brand-soft)", color: "var(--ink-2)" }}
      >
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand)" }} />
        <p>
          New vendor names create new vendors automatically. Existing names (case-insensitive) are
          reused. Each imported bill lands in <strong>needs_review</strong> so you can verify before
          approving.
        </p>
      </div>

      <details className="surface mt-6 text-[13px]">
        <summary
          className="cursor-pointer px-4 py-3 font-medium"
          style={{ listStyle: "none" }}
        >
          Need a template?
        </summary>
        <div className="px-4 py-3" style={{ borderTop: "1px solid var(--rule)" }}>
          <p className="text-[12.5px] text-ink-faint">
            Copy this into a file called <code className="font-mono">bills.csv</code>:
          </p>
          <pre
            className="mt-2 overflow-x-auto rounded-md p-3 font-mono text-[11.5px]"
            style={{
              background: "var(--paper-sunken)",
              color: "var(--ink-2)",
              border: "1px solid var(--rule-faint)",
            }}
          >
{`vendor_name,invoice_number,invoice_date,due_date,total,currency,notes
Acme Cloud Services,ACM-2026-0701,2026-07-01,2026-07-31,1416.47,USD,Net 30
Northwind Logistics,NW-99999,2026-07-05,2026-08-04,1325.48,USD,
Globex Office Supplies,GLX-771500,2026-07-10,2026-08-09,2948.10,USD,PO #4421`}
          </pre>
          <p className="mt-3 text-[12.5px] text-ink-faint">
            Required columns: <code className="font-mono">vendor_name</code>,{" "}
            <code className="font-mono">total</code>. The rest are optional.
          </p>
        </div>
      </details>
    </div>
  );
}
