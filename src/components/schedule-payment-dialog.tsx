"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, FileText, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { schedulePayment } from "@/app/bills/actions";
import { dollarsToCents, formatMoney } from "@/lib/utils";

function defaultPayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

const METHODS = [
  { id: "ach" as const, label: "ACH", sub: "2–3 business days", icon: Banknote },
  { id: "check" as const, label: "Check", sub: "Mailed next business day", icon: FileText },
  { id: "card" as const, label: "Card", sub: "Same-day, 2.9% fee", icon: CreditCard },
];

// Caller renders this dialog conditionally on open state so the
// component unmounts/remounts and useState initializers handle reset.
export function SchedulePaymentDialog({
  onOpenChange,
  bill,
}: {
  onOpenChange: (v: boolean) => void;
  bill: BillDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultPayDate);
  const [method, setMethod] = useState<"ach" | "check" | "card">(
    bill.vendor?.defaultPaymentMethod ?? "ach"
  );
  const [amountDollars, setAmountDollars] = useState(
    ((bill.totalCents ?? 0) / 100).toFixed(2)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = dollarsToCents(amountDollars);
    if (cents <= 0) {
      toast.error("Amount must be positive");
      return;
    }
    startTransition(async () => {
      const res = await schedulePayment(bill.id, {
        scheduledFor: date,
        method,
        amountCents: cents,
      });
      if (res.ok) {
        toast.success("Payment scheduled", {
          description: `${formatMoney(cents)} via ${method.toUpperCase()} on ${date}`,
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("Could not schedule payment", { description: res.error });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(20,18,14,0.32)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fade-up w-full max-w-[520px] overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 14,
          boxShadow: "var(--shadow-pop)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-border px-[18px] py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper-sunken text-ink-2">
              <Send className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Schedule payment</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                {bill.vendor?.name ?? "Vendor"} · {formatMoney(bill.totalCents, bill.currency)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-ghost grid h-7 w-7 place-items-center rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-[18px] py-4">
          <label className="flex flex-col gap-1.5">
            <span className="micro">Pay on</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              required
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="micro">Method</span>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className="flex flex-col gap-1 rounded-lg p-3 text-left transition-colors"
                    style={{
                      background: "var(--surface)",
                      border: `1px solid ${active ? "var(--ink)" : "var(--rule)"}`,
                      boxShadow: active ? "0 0 0 3px oklch(0.205 0.012 65 / 0.08)" : "none",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                    <div className="text-[13px] font-medium">{m.label}</div>
                    <div className="text-[11px] text-ink-faint leading-tight">{m.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="micro">Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-fainter text-[13px]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className="input tabular pl-6 font-mono"
                required
              />
            </div>
            <p className="text-[11.5px] text-ink-faint">
              Bill total: <span className="tabular font-mono">{formatMoney(bill.totalCents, bill.currency)}</span>
            </p>
          </label>
        </form>

        <div
          className="flex items-center justify-end gap-2 border-t border-border px-[18px] py-3.5"
          style={{ background: "var(--paper-sunken)" }}
        >
          <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={isPending}
            className="btn btn-brand btn-sm"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
