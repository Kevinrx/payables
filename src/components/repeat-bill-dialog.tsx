"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Repeat } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { repeatBill } from "@/app/bills/actions";

type Frequency = "monthly" | "quarterly" | "yearly";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function RepeatBillDialog({
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
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [count, setCount] = useState(12);

  const canSubmit = !!bill.invoiceDate && !!bill.dueDate;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await repeatBill(bill.id, { frequency, count });
      if (res.ok && res.data) {
        toast.success(`Created ${res.data.created} ${frequency} bills`, {
          description: "They're in your bills list as drafts.",
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("Could not repeat bill", {
          description: res.ok ? "Unknown error" : res.error,
        });
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
            <h2 className="text-base font-semibold">Repeat this bill</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Generate future copies as draft bills. Dates shift forward; amounts stay the same.
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

        {!canSubmit ? (
          <div className="px-5 py-4 text-sm text-muted-foreground">
            This bill needs both an invoice date and a due date before it can be
            repeated. Edit the bill, save, and try again.
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-md border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Frequency
              </label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`h-9 rounded-md border text-sm font-medium transition-colors ${
                      frequency === f
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-border-strong"
                    }`}
                  >
                    {FREQUENCY_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Number of copies
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm tabular focus:border-foreground focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Between 1 and 24. We'll create draft bills you can review later.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Preview:</span> generates{" "}
              {count} {frequency} draft{count > 1 ? "s" : ""} starting{" "}
              {frequency === "monthly"
                ? "next month"
                : frequency === "quarterly"
                ? "in 3 months"
                : "next year"}
              .
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
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
                Generate
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
