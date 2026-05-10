"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { schedulePayment } from "@/app/bills/actions";
import { dollarsToCents, formatMoney } from "@/lib/utils";

function defaultPayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3); // T+3 business-ish
  return d.toISOString().slice(0, 10);
}

export function SchedulePaymentDialog({
  open,
  onOpenChange,
  bill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bill: BillDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultPayDate());
  const [method, setMethod] = useState<"ach" | "check" | "card">(
    bill.vendor?.defaultPaymentMethod ?? "ach"
  );
  const [amountDollars, setAmountDollars] = useState(
    ((bill.totalCents ?? 0) / 100).toFixed(2)
  );

  // Reset when reopened.
  useEffect(() => {
    if (open) {
      setDate(defaultPayDate());
      setMethod(bill.vendor?.defaultPaymentMethod ?? "ach");
      setAmountDollars(((bill.totalCents ?? 0) / 100).toFixed(2));
    }
  }, [open, bill]);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Schedule payment</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pay {bill.vendor?.name ?? "vendor"} — invoice {bill.invoiceNumber ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pay date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:border-foreground focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Method
            </label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["ach", "check", "card"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`h-9 rounded-md border text-sm font-medium uppercase tracking-wide transition-colors ${
                    method === m
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:border-border-strong"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background pl-6 pr-3 text-sm tabular focus:border-foreground focus:outline-none"
                required
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Bill total: {formatMoney(bill.totalCents, bill.currency)}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-md border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Schedule payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
