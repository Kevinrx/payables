import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import {
  getBillById,
  getDemoOrgId,
  listAllocationTemplates,
  type BillDetail,
} from "@/db/queries";
import { canManageTemplates } from "@/lib/permissions";
import type { SplitTemplate } from "@/components/line-item-splits-dialog";
import { BillActions } from "@/components/bill-actions";
import { BillEditor } from "@/components/bill-editor";
import { BillEventTimeline } from "@/components/bill-event-timeline";
import { BillHero } from "@/components/bill-hero";
import { BillReadOnlyDetails, BillReadOnlyLineItems } from "@/components/bill-readonly";
import { CategoryBreakdown, hasAnySplits } from "@/components/category-breakdown";
import { ExtractionPending } from "@/components/extraction-pending";
import { FilePreview } from "@/components/file-preview";
import { LifecycleStepper } from "@/components/lifecycle-stepper";
import { PaymentsTable } from "@/components/payments-table";

export const dynamic = "force-dynamic";

export default async function BillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const orgId = await getDemoOrgId();
  const bill = await getBillById(id, orgId);
  if (!bill) notFound();

  const templateRows = await listAllocationTemplates(orgId);
  const templates: SplitTemplate[] = templateRows.map((t) => ({
    id: t.id,
    name: t.name,
    splits: t.splits,
  }));
  const canManage = canManageTemplates(orgId);

  const back = resolveBackTarget(from, bill.vendor);

  const needsExtraction =
    bill.status === "draft" &&
    bill.source === "upload" &&
    !!bill.fileUrl &&
    !!bill.fileMime &&
    !bill.extractedJson;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7">
      <Link href={back.href} className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        {back.label}
      </Link>

      {needsExtraction ? (
        <>
          <div className="mt-3 mb-4">
            <h1 className="text-[26px] font-semibold tracking-tight">New bill</h1>
            <p className="mt-1 text-[13px] text-ink-faint font-mono">{bill.fileName ?? "Uploaded file"}</p>
          </div>
          <ExtractionPending
            billId={bill.id}
            fileUrl={bill.fileUrl!}
            fileMime={bill.fileMime!}
            fileName={bill.fileName ?? "invoice"}
          />
        </>
      ) : (
        <BillBody bill={bill} templates={templates} canManageTemplates={canManage} />
      )}
    </div>
  );
}

function BillBody({
  bill,
  templates,
  canManageTemplates,
}: {
  bill: BillDetail;
  templates: SplitTemplate[];
  canManageTemplates: boolean;
}) {
  const isEditable = bill.status === "draft" || bill.status === "needs_review";

  return (
    <>
      <BillHero bill={bill} />

      <div className="mt-5">
        <LifecycleStepper status={bill.status} actions={<BillActions bill={bill} />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* LEFT — work surface */}
        <div className="min-w-0 flex flex-col gap-5">
          {isEditable ? (
            <BillEditor
              bill={bill}
              templates={templates}
              canManageTemplates={canManageTemplates}
            />
          ) : (
            <>
              <BillReadOnlyDetails bill={bill} />
              <BillReadOnlyLineItems bill={bill} />
            </>
          )}

          {hasAnySplits(bill) && <CategoryBreakdown bill={bill} />}

          <PaymentsTable bill={bill} />
        </div>

        {/* RIGHT — document + activity */}
        <div className="min-w-0 flex flex-col gap-5 lg:sticky lg:top-[72px]">
          <FileSection bill={bill} />

          <section className="surface overflow-hidden">
            <div className="border-b border-border px-[18px] py-3.5">
              <span className="micro">Activity</span>
            </div>
            <div className="p-[18px]">
              <BillEventTimeline events={bill.events} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function FileSection({ bill }: { bill: BillDetail }) {
  return (
    <section className="surface overflow-hidden">
      <div
        className="flex items-center justify-between border-b border-border px-3.5 py-2.5"
        style={{ background: "var(--paper-sunken)" }}
      >
        <div className="flex items-center gap-2 text-[12px] text-ink-faint">
          <FileText className="h-3.5 w-3.5" />
          <span className="font-mono">{bill.fileName ?? "no file"}</span>
        </div>
        {bill.fileUrl && (
          <a
            href={bill.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint hover:text-ink"
          >
            Open
          </a>
        )}
      </div>
      <div className="p-3">
        {bill.fileUrl ? (
          <FilePreview
            url={bill.fileUrl}
            mime={bill.fileMime ?? "application/octet-stream"}
            name={bill.fileName ?? "invoice"}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-lg px-6 py-10 text-center"
            style={{
              background: "var(--paper-sunken)",
              border: "1px dashed var(--rule-strong)",
            }}
          >
            <FileText className="h-6 w-6 text-ink-fainter" />
            <p className="mt-2 text-[13px] text-ink-faint">No file attached.</p>
            <p className="mt-1 text-[11.5px] text-ink-fainter">Manual or CSV-imported bill.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function resolveBackTarget(
  from: string | undefined,
  vendor: BillDetail["vendor"]
): { href: string; label: string } {
  if (from?.startsWith("vendor:")) {
    const vendorId = from.slice("vendor:".length);
    if (vendorId && (!vendor || vendor.id === vendorId)) {
      const label = vendor?.name ? `Back to ${vendor.name}` : "Back to vendor";
      return { href: `/vendors/${vendorId}`, label };
    }
  }
  return { href: "/bills", label: "Back to bills" };
}
