import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { FileUploader } from "@/components/file-uploader";
import { CreateManualBillLink } from "@/components/create-manual-bill-link";

export default function NewBillPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/bills"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to bills
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold tracking-tight">Upload an invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a PDF or image. We'll use Claude to extract vendor, amounts, dates, and line items.
        </p>
      </div>

      <div className="mt-6">
        <FileUploader />
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-border bg-info-bg/50 px-4 py-3 text-sm text-info">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Extraction runs as soon as the upload finishes — it usually takes 5–10 seconds.
          You can edit anything Claude got wrong on the next screen.
        </p>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <CreateManualBillLink />
      </div>
    </div>
  );
}
