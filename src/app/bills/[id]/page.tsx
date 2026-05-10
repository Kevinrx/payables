import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getBillById, getDemoOrgId, type BillDetail } from "@/db/queries";
import { StatusBadge } from "@/components/status-badge";
import { BillActions } from "@/components/bill-actions";
import { BillEventTimeline } from "@/components/bill-event-timeline";
import { FilePreview } from "@/components/file-preview";
import { ExtractionPending } from "@/components/extraction-pending";
import { BillEditor } from "@/components/bill-editor";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getDemoOrgId();
  const bill = await getBillById(id, orgId);
  if (!bill) notFound();

  const needsExtraction =
    bill.status === "draft" &&
    bill.source === "upload" &&
    !!bill.fileUrl &&
    !!bill.fileMime &&
    !bill.extractedJson;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/bills"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to bills
      </Link>

      {needsExtraction ? (
        <>
          <div className="mt-3 mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">New bill</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bill.fileName ?? "Uploaded file"}
            </p>
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
  return (
    <>
      {/* Header */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {bill.vendor?.name ?? "Unmatched vendor"}
            </h1>
            <StatusBadge status={bill.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Invoice {bill.invoiceNumber ?? "—"}</span>
            <span className="h-1 w-1 rounded-full bg-border-strong" />
            <span>Due {formatDate(bill.dueDate)}</span>
            {bill.notes && (
              <>
                <span className="h-1 w-1 rounded-full bg-border-strong" />
                <span className="italic">{bill.notes}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-3xl font-semibold tabular tracking-tight">
            {formatMoney(bill.totalCents, bill.currency)}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <BillActions bill={bill} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          {isEditable ? (
            <BillEditor bill={bill} />
          ) : (
            <Section title="Bill details">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Vendor" value={bill.vendor?.name ?? "—"} />
                <Field label="Invoice #" value={bill.invoiceNumber ?? "—"} />
                <Field label="Invoice date" value={formatDate(bill.invoiceDate)} />
                <Field label="Due date" value={formatDate(bill.dueDate)} />
                <Field label="Subtotal" value={formatMoney(bill.subtotalCents, bill.currency)} />
                <Field label="Tax" value={formatMoney(bill.taxCents, bill.currency)} />
                <Field
                  label="Total"
                  value={formatMoney(bill.totalCents, bill.currency)}
                  emphasize
                />
                <Field label="Currency" value={bill.currency} />
              </dl>
            </Section>
          )}

          {!isEditable && (
            <Section title={`Line items (${bill.lineItems.length})`}>
              {bill.lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lineItems.map((li) => (
                      <tr key={li.id} className="border-b border-border last:border-b-0">
                        <td className="py-2.5">{li.description}</td>
                        <td className="py-2.5 text-right tabular">{li.quantity ?? "—"}</td>
                        <td className="py-2.5 text-right tabular">
                          {formatMoney(li.unitPriceCents, bill.currency)}
                        </td>
                        <td className="py-2.5 text-right tabular font-medium">
                          {formatMoney(li.amountCents, bill.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          )}

          <Section title={`Payments (${bill.payments.length})`}>
            {bill.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2">Scheduled</th>
                    <th className="pb-2">Paid</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-b-0">
                      <td className="py-2.5 tabular">{formatDate(p.scheduledFor)}</td>
                      <td className="py-2.5 tabular">
                        {p.paidAt ? formatDate(p.paidAt) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 uppercase text-xs tracking-wider">{p.method}</td>
                      <td className="py-2.5 capitalize">{p.status}</td>
                      <td className="py-2.5 text-right tabular font-medium">
                        {formatMoney(p.amountCents, bill.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Section title="Original document" tight>
            {bill.fileUrl ? (
              <FilePreview
                url={bill.fileUrl}
                mime={bill.fileMime ?? "application/octet-stream"}
                name={bill.fileName ?? "invoice"}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No file attached.</p>
              </div>
            )}
          </Section>

          <Section title="Activity">
            <BillEventTimeline events={bill.events} />
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  children,
  tight,
}: {
  title: string;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
      </div>
      <div className={tight ? "p-3" : "p-4"}>{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasize
            ? "mt-0.5 text-base font-semibold tabular tracking-tight"
            : "mt-0.5 truncate"
        }
      >
        {value}
      </dd>
    </div>
  );
}
