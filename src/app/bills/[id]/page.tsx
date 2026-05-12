import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, Repeat, Tag } from "lucide-react";
import { getBillById, getDemoOrgId, type BillDetail } from "@/db/queries";
import { StatusBadge } from "@/components/status-badge";
import { BillActions } from "@/components/bill-actions";
import { BillEventTimeline } from "@/components/bill-event-timeline";
import { FilePreview } from "@/components/file-preview";
import { ExtractionPending } from "@/components/extraction-pending";
import { BillEditor } from "@/components/bill-editor";
import { LifecycleStepper } from "@/components/lifecycle-stepper";
import { allocateCents, formatSplitSummary, type LineItemSplit } from "@/lib/categories";
import { daysUntilDue, formatDate, formatMoney } from "@/lib/utils";

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

  const back = resolveBackTarget(from, bill.vendor);

  const needsExtraction =
    bill.status === "draft" &&
    bill.source === "upload" &&
    !!bill.fileUrl &&
    !!bill.fileMime &&
    !bill.extractedJson;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7">
      <Link
        href={back.href}
        className="btn btn-ghost btn-sm -ml-2"
      >
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
        <BillBody bill={bill} />
      )}
    </div>
  );
}

function BillBody({ bill }: { bill: BillDetail }) {
  const isEditable = bill.status === "draft" || bill.status === "needs_review";
  const days = daysUntilDue(bill.dueDate);
  const isOverdue =
    days !== null && days < 0 && bill.status !== "paid" && bill.status !== "void";

  return (
    <>
      {/* Hero band */}
      <div className="mt-3 grid grid-cols-1 gap-4 border-b border-border pb-5 sm:gap-6 sm:pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <div className="micro mb-2">
            Bill · <span className="font-mono tabular">{bill.invoiceNumber ?? "—"}</span>
            {isOverdue && (
              <>
                <span className="mx-2 text-ink-fainter">·</span>
                <span style={{ color: "var(--danger-strong)" }}>
                  {Math.abs(days!)} DAYS OVERDUE
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <h1
              className="text-[24px] font-semibold tracking-tight sm:text-[36px]"
              style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
            >
              {bill.vendor?.name ?? (bill.source === "manual" ? "Untitled bill" : "Unmatched vendor")}
            </h1>
            <StatusBadge status={isOverdue ? "overdue" : bill.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-faint">
            <span className="tabular">Due {formatDate(bill.dueDate)}</span>
            <Dot />
            <span className="tabular">Invoiced {formatDate(bill.invoiceDate)}</span>
            {bill.vendor?.defaultPaymentMethod && (
              <>
                <Dot />
                <span className="uppercase font-mono text-[11.5px] tracking-wider">
                  Pay via {bill.vendor.defaultPaymentMethod}
                </span>
              </>
            )}
            {bill.parentBillId && (
              <>
                <Dot />
                <Link
                  href={`/bills/${bill.parentBillId}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                  style={{ background: "var(--paper-sunken)", color: "var(--ink-2)" }}
                >
                  <Repeat className="h-2.5 w-2.5" /> Recurring · view source
                </Link>
              </>
            )}
            {bill.notes && (
              <>
                <Dot />
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                  style={{ background: "var(--warn-soft)", color: "var(--warn-strong)" }}
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> {bill.notes}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="micro mb-1.5">Total due</div>
          <div
            className="tabular font-mono text-[34px] sm:text-[48px]"
            style={{
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              color: isOverdue ? "var(--danger-strong)" : "var(--ink)",
            }}
          >
            {formatMoney(bill.totalCents, bill.currency)}
          </div>
          {bill.taxCents != null && bill.taxCents > 0 && (
            <div className="mt-1.5 text-[11px] uppercase tracking-wider font-mono text-ink-fainter">
              {bill.currency} · INCL. {formatMoney(bill.taxCents, bill.currency)} TAX
            </div>
          )}
        </div>
      </div>

      {/* Lifecycle stepper + primary action */}
      <div className="mt-5">
        <LifecycleStepper status={bill.status} actions={<BillActions bill={bill} />} />
      </div>

      {/* Two-pane body */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* LEFT — work surface */}
        <div className="min-w-0 flex flex-col gap-5">
          {isEditable ? (
            <BillEditor bill={bill} />
          ) : (
            <>
              <ReadOnlyDetails bill={bill} />
              <ReadOnlyLineItems bill={bill} />
            </>
          )}

          {hasAnySplits(bill) && (
            <section className="surface overflow-hidden">
              <div className="border-b border-border px-[18px] py-3.5">
                <span className="micro">Category breakdown</span>
              </div>
              <div className="p-[18px]">
                <CategoryBreakdown bill={bill} />
              </div>
            </section>
          )}

          <section className="surface overflow-hidden">
            <div className="border-b border-border px-[18px] py-3.5">
              <span className="micro">Payments ({bill.payments.length})</span>
            </div>
            <div className="p-[18px]">
              {bill.payments.length === 0 ? (
                <p className="text-[13px] text-ink-faint">
                  No payments yet. Approve this bill, then schedule a payment when you're ready.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-[18px] px-[18px]">
                <table className="w-full min-w-[480px] text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2"><span className="micro">Scheduled</span></th>
                      <th className="pb-2"><span className="micro">Paid</span></th>
                      <th className="pb-2"><span className="micro">Method</span></th>
                      <th className="pb-2"><span className="micro">Status</span></th>
                      <th className="pb-2 text-right"><span className="micro">Amount</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-b-0">
                        <td className="py-3 tabular font-mono">{formatDate(p.scheduledFor)}</td>
                        <td className="py-3 tabular font-mono">
                          {p.paidAt ? formatDate(p.paidAt) : <span className="text-ink-fainter">—</span>}
                        </td>
                        <td className="py-3 uppercase text-[11px] tracking-wider font-mono">{p.method}</td>
                        <td className="py-3 capitalize">{p.status}</td>
                        <td className="py-3 text-right tabular font-mono font-medium">
                          {formatMoney(p.amountCents, bill.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT — document + activity */}
        <div className="min-w-0 flex flex-col gap-5 lg:sticky lg:top-[72px]">
          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5" style={{ background: "var(--paper-sunken)" }}>
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

function Dot() {
  return <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--rule-strong)" }} />;
}

function ReadOnlyDetails({ bill }: { bill: BillDetail }) {
  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border px-[18px] py-3.5">
        <span className="micro">Bill details</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5 p-[18px] text-[13px]">
        <Field label="Vendor" value={bill.vendor?.name ?? "—"} />
        <Field label="Invoice #" value={bill.invoiceNumber ?? "—"} mono />
        <Field label="Invoice date" value={formatDate(bill.invoiceDate)} mono />
        <Field label="Due date" value={formatDate(bill.dueDate)} mono />
        <Field label="Subtotal" value={formatMoney(bill.subtotalCents, bill.currency)} mono />
        <Field label="Tax" value={formatMoney(bill.taxCents, bill.currency)} mono />
        <Field label="Total" value={formatMoney(bill.totalCents, bill.currency)} mono emphasize />
        <Field label="Currency" value={bill.currency} mono />
      </dl>
    </section>
  );
}

function ReadOnlyLineItems({ bill }: { bill: BillDetail }) {
  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border px-[18px] py-3.5">
        <span className="micro">Line items ({bill.lineItems.length})</span>
      </div>
      <div>
        {bill.lineItems.length === 0 ? (
          <p className="p-[18px] text-[13px] text-ink-faint">No line items.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr
                className="border-b border-border text-left"
                style={{ background: "var(--paper-sunken)" }}
              >
                <th className="px-[18px] py-2.5"><span className="micro">Description</span></th>
                <th className="px-[18px] py-2.5 text-right"><span className="micro">Qty</span></th>
                <th className="px-[18px] py-2.5 text-right"><span className="micro">Unit</span></th>
                <th className="px-[18px] py-2.5 text-right"><span className="micro">Amount</span></th>
              </tr>
            </thead>
            <tbody>
              {bill.lineItems.map((li) => {
                const splits = (li.splits as LineItemSplit[] | null) ?? null;
                return (
                  <tr key={li.id} className="border-b border-border last:border-b-0 align-top">
                    <td className="px-[18px] py-3">
                      <div>{li.description}</div>
                      {splits && splits.length > 0 && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {formatSplitSummary(splits)}
                        </div>
                      )}
                    </td>
                    <td className="px-[18px] py-3 text-right tabular font-mono">{li.quantity ?? "—"}</td>
                    <td className="px-[18px] py-3 text-right tabular font-mono text-ink-faint">
                      {formatMoney(li.unitPriceCents, bill.currency)}
                    </td>
                    <td className="px-[18px] py-3 text-right tabular font-mono font-medium">
                      {formatMoney(li.amountCents, bill.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function hasAnySplits(bill: BillDetail): boolean {
  return bill.lineItems.some((li) => {
    const s = li.splits as LineItemSplit[] | null;
    return s && s.length > 0;
  });
}

function CategoryBreakdown({ bill }: { bill: BillDetail }) {
  const totals = new Map<string, number>();
  let uncategorized = 0;
  for (const li of bill.lineItems) {
    const splits = (li.splits as LineItemSplit[] | null) ?? null;
    if (!splits || splits.length === 0) {
      uncategorized += li.amountCents;
      continue;
    }
    for (const a of allocateCents(li.amountCents, splits)) {
      totals.set(a.category, (totals.get(a.category) ?? 0) + a.cents);
    }
  }
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0) + uncategorized;

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="pb-2"><span className="micro">Category</span></th>
          <th className="pb-2 text-right"><span className="micro">Amount</span></th>
          <th className="pb-2 text-right"><span className="micro">% of total</span></th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(([cat, cents]) => (
          <tr key={cat} className="border-b border-border last:border-b-0">
            <td className="py-2.5">{cat}</td>
            <td className="py-2.5 text-right tabular font-mono font-medium">
              {formatMoney(cents, bill.currency)}
            </td>
            <td className="py-2.5 text-right tabular font-mono text-ink-faint">
              {grandTotal > 0 ? ((cents / grandTotal) * 100).toFixed(1) : "0"}%
            </td>
          </tr>
        ))}
        {uncategorized > 0 && (
          <tr className="border-b border-border last:border-b-0 text-ink-faint">
            <td className="py-2.5 italic">Uncategorized</td>
            <td className="py-2.5 text-right tabular font-mono">
              {formatMoney(uncategorized, bill.currency)}
            </td>
            <td className="py-2.5 text-right tabular font-mono">
              {grandTotal > 0 ? ((uncategorized / grandTotal) * 100).toFixed(1) : "0"}%
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Field({
  label,
  value,
  mono,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="micro">{label}</dt>
      <dd
        className={`mt-1 truncate ${mono ? "tabular font-mono" : ""} ${emphasize ? "text-[15px] font-semibold tracking-tight" : ""}`}
      >
        {value}
      </dd>
    </div>
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
