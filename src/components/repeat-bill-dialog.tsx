"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat, X } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { repeatBill } from "@/app/bills/actions";

type Frequency = "monthly" | "quarterly" | "yearly";

const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
];

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
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(20,18,14,0.32)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fade-up w-full max-w-[500px] overflow-hidden"
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
              <Repeat className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Repeat this bill</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                Generate future copies as draft bills. Dates shift forward; amounts stay the same.
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

        {!canSubmit ? (
          <>
            <div className="px-[18px] py-4 text-[13px] text-ink-faint">
              This bill needs both an invoice date and a due date before it can be repeated. Edit the bill, save, and try again.
            </div>
            <div
              className="flex items-center justify-end gap-2 border-t border-border px-[18px] py-3.5"
              style={{ background: "var(--paper-sunken)" }}
            >
              <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost btn-sm">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-[18px] py-4">
              <div className="flex flex-col gap-1.5">
                <span className="micro">Cadence</span>
                <div className="tabs" style={{ width: "100%" }}>
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="tab"
                      data-active={frequency === f.id}
                      onClick={() => setFrequency(f.id)}
                      style={{ flex: 1 }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="micro">Number of copies</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                  className="input tabular font-mono"
                  required
                />
                <p className="text-[11.5px] text-ink-faint">
                  Between 1 and 24. We&apos;ll create draft bills you can review later.
                </p>
              </label>

              <div
                className="rounded-lg p-3 text-[12.5px] leading-relaxed"
                style={{ background: "var(--brand-soft)", color: "var(--ink-2)" }}
              >
                <strong style={{ color: "var(--brand)" }}>Heads up:</strong> we&apos;ll create{" "}
                <span className="tabular font-mono">{count}</span> {frequency} draft{count > 1 ? "s" : ""}{" "}
                starting{" "}
                {frequency === "monthly"
                  ? "next month"
                  : frequency === "quarterly"
                  ? "in 3 months"
                  : "next year"}
                . Each will need review before approval.
              </div>
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
                className="btn btn-primary btn-sm"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}
                Create schedule
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
