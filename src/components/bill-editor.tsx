"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { updateBill } from "@/app/bills/actions";
import { dollarsToCents, formatMoney } from "@/lib/utils";

type LineItemDraft = {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  amount: string;
};

function toDollarString(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function billToLineItemDrafts(bill: BillDetail): LineItemDraft[] {
  if (bill.lineItems.length === 0) {
    return [{ key: crypto.randomUUID(), description: "", quantity: "", unit: "", amount: "" }];
  }
  return bill.lineItems.map((li) => ({
    key: li.id,
    description: li.description,
    quantity: li.quantity?.toString() ?? "",
    unit: toDollarString(li.unitPriceCents),
    amount: toDollarString(li.amountCents),
  }));
}

export function BillEditor({ bill }: { bill: BillDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [vendorName, setVendorName] = useState(bill.vendor?.name ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(bill.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(bill.invoiceDate ?? "");
  const [dueDate, setDueDate] = useState(bill.dueDate ?? "");
  const [subtotal, setSubtotal] = useState(toDollarString(bill.subtotalCents));
  const [tax, setTax] = useState(toDollarString(bill.taxCents));
  const [total, setTotal] = useState(toDollarString(bill.totalCents));
  const [notes, setNotes] = useState(bill.notes ?? "");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() => billToLineItemDrafts(bill));

  const lineItemsTotal = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + dollarsToCents(li.amount), 0);
  }, [lineItems]);

  function updateLine(key: string, patch: Partial<LineItemDraft>) {
    setLineItems((items) =>
      items.map((li) => {
        if (li.key !== key) return li;
        const next = { ...li, ...patch };
        // Auto-compute amount when qty and unit are both set.
        if (("quantity" in patch || "unit" in patch) && !("amount" in patch)) {
          const q = parseFloat(next.quantity);
          const u = parseFloat(next.unit);
          if (Number.isFinite(q) && Number.isFinite(u)) {
            next.amount = (q * u).toFixed(2);
          }
        }
        return next;
      })
    );
  }

  function addLine() {
    setLineItems((items) => [
      ...items,
      { key: crypto.randomUUID(), description: "", quantity: "", unit: "", amount: "" },
    ]);
  }

  function removeLine(key: string) {
    setLineItems((items) => items.filter((li) => li.key !== key));
  }

  function handleSave() {
    const cleanedLines = lineItems
      .filter((li) => li.description.trim().length > 0)
      .map((li) => ({
        description: li.description.trim(),
        quantity: li.quantity ? Math.round(parseFloat(li.quantity)) : null,
        unitPriceCents: li.unit ? dollarsToCents(li.unit) : null,
        amountCents: dollarsToCents(li.amount),
      }));

    startTransition(async () => {
      const res = await updateBill(bill.id, {
        vendorId: null, // resolved server-side by name
        vendorName: vendorName.trim() || null,
        invoiceNumber: invoiceNumber.trim() || null,
        invoiceDate: invoiceDate || null,
        dueDate: dueDate || null,
        subtotalCents: subtotal ? dollarsToCents(subtotal) : null,
        taxCents: tax ? dollarsToCents(tax) : null,
        totalCents: total ? dollarsToCents(total) : null,
        notes: notes.trim() || null,
        lineItems: cleanedLines,
      });
      if (res.ok) {
        toast.success("Saved", { description: "Bill updated." });
        router.refresh();
      } else {
        toast.error("Save failed", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium tracking-tight">Bill details</h2>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
          <FieldInput
            label="Vendor"
            value={vendorName}
            onChange={setVendorName}
            placeholder="e.g. Acme Cloud Services"
          />
          <FieldInput
            label="Invoice #"
            value={invoiceNumber}
            onChange={setInvoiceNumber}
            placeholder="INV-001"
          />
          <FieldInput
            label="Invoice date"
            type="date"
            value={invoiceDate}
            onChange={setInvoiceDate}
          />
          <FieldInput
            label="Due date"
            type="date"
            value={dueDate}
            onChange={setDueDate}
          />
          <MoneyInput label="Subtotal" value={subtotal} onChange={setSubtotal} />
          <MoneyInput label="Tax" value={tax} onChange={setTax} />
          <MoneyInput label="Total" value={total} onChange={setTotal} emphasize />
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal memo (optional)"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:border-foreground focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium tracking-tight">Line items</h2>
          <LineItemSumIndicator
            lineItemsTotal={lineItemsTotal}
            subtotal={dollarsToCents(subtotal)}
            currency={bill.currency}
          />
        </div>

        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Description</th>
                <th className="pb-2 w-20 text-right">Qty</th>
                <th className="pb-2 w-28 text-right">Unit</th>
                <th className="pb-2 w-32 text-right">Amount</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.key} className="border-b border-border last:border-b-0">
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => updateLine(li.key, { description: e.target.value })}
                      placeholder="Line item description"
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:border-border focus:border-foreground focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="1"
                      value={li.quantity}
                      onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-right text-sm tabular hover:border-border focus:border-foreground focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={li.unit}
                      onChange={(e) => updateLine(li.key, { unit: e.target.value })}
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-right text-sm tabular hover:border-border focus:border-foreground focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={li.amount}
                      onChange={(e) => updateLine(li.key, { amount: e.target.value })}
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-right text-sm tabular font-medium hover:border-border focus:border-foreground focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => removeLine(li.key)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger"
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addLine}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add line item
          </button>
        </div>
      </section>
    </div>
  );
}

function LineItemSumIndicator({
  lineItemsTotal,
  subtotal,
  currency,
}: {
  lineItemsTotal: number;
  subtotal: number;
  currency: string;
}) {
  // Compare lines to subtotal (lines don't include tax). When the user hasn't
  // entered a subtotal yet, just show the sum without a comparison.
  const hasSubtotal = subtotal > 0;
  const matches = hasSubtotal && lineItemsTotal === subtotal;
  return (
    <span className="text-xs text-muted-foreground tabular">
      Lines sum: {formatMoney(lineItemsTotal, currency)}
      {hasSubtotal && !matches && (
        <span className="ml-1 text-warning">
          (subtotal is {formatMoney(subtotal, currency)})
        </span>
      )}
      {matches && <span className="ml-1 text-success">✓</span>}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:border-foreground focus:outline-none"
      />
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  emphasize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  emphasize?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-9 w-full rounded-md border border-border bg-background pl-6 pr-3 text-sm tabular focus:border-foreground focus:outline-none ${
            emphasize ? "font-semibold" : ""
          }`}
        />
      </div>
    </div>
  );
}
