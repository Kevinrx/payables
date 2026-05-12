"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { updateBill } from "@/app/bills/actions";
import { dollarsToCents, formatMoney } from "@/lib/utils";
import { formatSplitSummary, type LineItemSplit } from "@/lib/categories";
import { LineItemSplitsDialog } from "./line-item-splits-dialog";

type LineItemDraft = {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  amount: string;
  splits: LineItemSplit[] | null;
};

function toDollarString(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function billToLineItemDrafts(bill: BillDetail): LineItemDraft[] {
  if (bill.lineItems.length === 0) {
    return [{ key: crypto.randomUUID(), description: "", quantity: "", unit: "", amount: "", splits: null }];
  }
  return bill.lineItems.map((li) => ({
    key: li.id,
    description: li.description,
    quantity: li.quantity?.toString() ?? "",
    unit: toDollarString(li.unitPriceCents),
    amount: toDollarString(li.amountCents),
    splits: (li.splits as LineItemSplit[] | null) ?? null,
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
  const [splittingKey, setSplittingKey] = useState<string | null>(null);

  const splittingLine = lineItems.find((li) => li.key === splittingKey) ?? null;

  const lineItemsTotal = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + dollarsToCents(li.amount), 0);
  }, [lineItems]);

  function updateLine(key: string, patch: Partial<LineItemDraft>) {
    setLineItems((items) =>
      items.map((li) => {
        if (li.key !== key) return li;
        const next = { ...li, ...patch };
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
      { key: crypto.randomUUID(), description: "", quantity: "", unit: "", amount: "", splits: null },
    ]);
  }

  function setLineSplits(key: string, splits: LineItemSplit[] | null) {
    setLineItems((items) => items.map((li) => (li.key === key ? { ...li, splits } : li)));
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
        splits: li.splits,
      }));

    startTransition(async () => {
      const res = await updateBill(bill.id, {
        vendorId: null,
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
    <div className="flex flex-col gap-5">
      {/* Bill details */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
          <span className="micro">Bill details</span>
          <button type="button" onClick={handleSave} disabled={isPending} className="btn btn-secondary btn-sm">
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-[18px] sm:grid-cols-2">
          <Field label="Vendor">
            <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Acme Cloud Services" className="input" />
          </Field>
          <Field label="Invoice #">
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" className="input font-mono tabular" />
          </Field>
          <Field label="Invoice date">
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input tabular font-mono" />
          </Field>
          <Field label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input tabular font-mono" />
          </Field>
          <Field label="Subtotal">
            <MoneyInput value={subtotal} onChange={setSubtotal} />
          </Field>
          <Field label="Tax">
            <MoneyInput value={tax} onChange={setTax} />
          </Field>
          <Field label="Total" emphasize>
            <MoneyInput value={total} onChange={setTotal} emphasize />
          </Field>
          <Field label="Notes">
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal memo (optional)" className="input" />
          </Field>
        </div>
      </section>

      {/* Line items */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
          <span className="micro">Line items</span>
          <LineItemSumIndicator
            lineItemsTotal={lineItemsTotal}
            subtotal={dollarsToCents(subtotal)}
            currency={bill.currency}
          />
        </div>

        <div>
          {/* Header row */}
          <div
            className="grid items-center gap-3 border-b border-border px-[18px] py-2.5"
            style={{ gridTemplateColumns: "minmax(0, 1.6fr) 60px 100px 110px 28px", background: "var(--paper-sunken)" }}
          >
            <span className="micro">Description</span>
            <span className="micro text-right">Qty</span>
            <span className="micro text-right">Unit</span>
            <span className="micro text-right">Amount</span>
            <span />
          </div>

          {lineItems.map((li) => (
            <div
              key={li.key}
              className="grid items-start gap-3 border-b border-border px-[18px] py-2.5 last:border-b-0"
              style={{ gridTemplateColumns: "minmax(0, 1.6fr) 60px 100px 110px 28px" }}
            >
              <div className="min-w-0">
                <input
                  type="text"
                  value={li.description}
                  onChange={(e) => updateLine(li.key, { description: e.target.value })}
                  placeholder="Line item description"
                  className="input input-inline"
                  style={{ height: 30 }}
                />
                <button
                  type="button"
                  onClick={() => setSplittingKey(li.key)}
                  className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors"
                  style={{
                    background: li.splits && li.splits.length > 0 ? "var(--brand-soft)" : "transparent",
                    color: li.splits && li.splits.length > 0 ? "var(--brand)" : "var(--ink-fainter)",
                    border: `1px dashed ${li.splits && li.splits.length > 0 ? "transparent" : "var(--rule-strong)"}`,
                  }}
                  title="Allocate to categories"
                >
                  <Tag className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[260px]">{formatSplitSummary(li.splits)}</span>
                </button>
              </div>
              <input
                type="number"
                step="1"
                value={li.quantity}
                onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                className="input input-inline tabular font-mono text-right"
                style={{ height: 30 }}
              />
              <input
                type="number"
                step="0.01"
                value={li.unit}
                onChange={(e) => updateLine(li.key, { unit: e.target.value })}
                className="input input-inline tabular font-mono text-right"
                style={{ height: 30 }}
              />
              <input
                type="number"
                step="0.01"
                value={li.amount}
                onChange={(e) => updateLine(li.key, { amount: e.target.value })}
                className="input input-inline tabular font-mono text-right font-medium"
                style={{ height: 30 }}
              />
              <button
                type="button"
                onClick={() => removeLine(li.key)}
                className="btn-ghost grid h-7 w-7 place-items-center rounded"
                aria-label="Remove line"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          <div
            className="flex items-center justify-between px-[18px] py-3"
            style={{ background: "var(--paper-sunken)" }}
          >
            <button type="button" onClick={addLine} className="btn btn-ghost btn-sm">
              <Plus className="h-3 w-3" />
              Add line item
            </button>
          </div>
        </div>
      </section>

      {splittingLine && (
        <LineItemSplitsDialog
          open={splittingKey !== null}
          onOpenChange={(v) => !v && setSplittingKey(null)}
          description={splittingLine.description || "Untitled line"}
          amountCents={dollarsToCents(splittingLine.amount)}
          initial={splittingLine.splits}
          onSave={(splits) => setLineSplits(splittingLine.key, splits)}
        />
      )}
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
  const hasSubtotal = subtotal > 0;
  const matches = hasSubtotal && lineItemsTotal === subtotal;
  return (
    <span className="text-[11.5px] text-ink-faint tabular font-mono">
      Lines sum:{" "}
      <span className={matches ? "text-ink" : "text-ink"}>
        {formatMoney(lineItemsTotal, currency)}
      </span>
      {hasSubtotal && !matches && (
        <span className="ml-1.5" style={{ color: "var(--warn-strong)" }}>
          (subtotal {formatMoney(subtotal, currency)})
        </span>
      )}
      {matches && <span className="ml-1.5" style={{ color: "var(--success)" }}>✓</span>}
    </span>
  );
}

function Field({
  label,
  children,
  emphasize,
}: {
  label: string;
  children: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="micro" style={{ color: emphasize ? "var(--ink)" : undefined }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function MoneyInput({
  value,
  onChange,
  emphasize,
}: {
  value: string;
  onChange: (v: string) => void;
  emphasize?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-fainter">
        $
      </span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input tabular font-mono pl-6 ${emphasize ? "font-semibold" : ""}`}
      />
    </div>
  );
}
