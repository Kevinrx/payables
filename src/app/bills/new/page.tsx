import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles, Upload } from "lucide-react";
import { FileUploader } from "@/components/file-uploader";
import { CreateManualBillCard } from "@/components/create-manual-bill-link";

export default function NewBillPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <Link href="/bills" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to bills
      </Link>

      <div className="mt-4">
        <span className="micro">New bill</span>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Upload an invoice</h1>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-faint">
          Drop a PDF or image. Claude reads the vendor, amounts, dates, and line items and lands
          you in a draft ready to review.
        </p>
      </div>

      <div className="mt-6">
        <FileUploader />
      </div>

      <div
        className="mt-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px]"
        style={{ background: "var(--info-soft)", color: "var(--ink-2)" }}
      >
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--info)" }} />
        <p>
          Extraction runs as soon as the upload finishes — typically 5–10 seconds. You can edit
          anything Claude got wrong on the next screen.
        </p>
      </div>

      <hr className="my-7" style={{ border: 0, borderTop: "1px solid var(--rule)" }} />

      <div className="grid gap-3 sm:grid-cols-2">
        <CreateManualBillCard />
        <Link
          href="/bills/import"
          className="surface focus-ring group flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-sunken"
        >
          <span
            className="grid h-8 w-8 flex-none place-items-center rounded-lg"
            style={{ background: "var(--paper-sunken)", color: "var(--ink-2)" }}
          >
            <Upload className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">Bulk import from CSV</div>
            <div className="mt-0.5 text-[12px] text-ink-faint">
              Drop a spreadsheet, get N drafts.
            </div>
          </div>
          <ArrowRight
            className="h-3.5 w-3.5 flex-none transition-transform group-hover:translate-x-0.5"
            style={{ color: "var(--ink-fainter)" }}
          />
        </Link>
      </div>
    </div>
  );
}
