import Link from "next/link";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Sparkles } from "lucide-react";
import { FileUploader } from "@/components/file-uploader";
import { CreateManualBillLink } from "@/components/create-manual-bill-link";

export default function NewBillPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <Link href="/bills" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to bills
      </Link>

      <div className="mt-3">
        <h1 className="text-[26px] font-semibold tracking-tight">Upload an invoice</h1>
        <p className="mt-1 text-[13px] text-ink-faint">
          Drop a PDF or image. We'll use Claude vision to extract vendor, amounts, dates, and line items.
        </p>
      </div>

      <div className="mt-6">
        <FileUploader />
      </div>

      <div
        className="mt-5 flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px]"
        style={{ background: "var(--brand-soft)", color: "var(--ink-2)" }}
      >
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand)" }} />
        <p>
          Extraction runs as soon as the upload finishes — it usually takes 5–10 seconds.
          You can edit anything Claude got wrong on the next screen.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
        <CreateManualBillLink />
        <Link
          href="/bills/import"
          className="inline-flex items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink"
        >
          <FileSpreadsheet className="h-3 w-3" />
          Or bulk-import from CSV
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
