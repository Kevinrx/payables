import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CsvImporter } from "@/components/csv-importer";
import { ExpectedColumnsPanel } from "@/components/expected-columns-panel";

export default function ImportBillsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <Link href="/bills" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to bills
      </Link>

      <div className="mt-4">
        <span className="micro">Bulk import</span>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Import from CSV</h1>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-faint">
          Drop a spreadsheet. Each row becomes a draft bill, ready for review.
        </p>
      </div>

      <div className="mt-6">
        <CsvImporter />
      </div>

      <div className="mt-5">
        <ExpectedColumnsPanel />
      </div>

      <div
        className="mt-5 flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px]"
        style={{ background: "var(--info-soft)", color: "var(--ink-2)" }}
      >
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--info)" }} />
        <p>
          We&apos;ll validate every row, then land you on a preview where you can fix anything
          before the drafts are created.
        </p>
      </div>
    </div>
  );
}
