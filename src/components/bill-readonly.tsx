import { Tag } from "lucide-react";
import type { BillDetail } from "@/db/queries";
import { formatSplitSummary, type LineItemSplit } from "@/lib/categories";
import { formatDate, formatMoney } from "@/lib/utils";

export function BillReadOnlyDetails({ bill }: { bill: BillDetail }) {
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

export function BillReadOnlyLineItems({ bill }: { bill: BillDetail }) {
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
        className={`mt-1 truncate ${mono ? "tabular font-mono" : ""} ${
          emphasize ? "text-[15px] font-semibold tracking-tight" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
