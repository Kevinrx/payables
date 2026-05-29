"use client";

import { useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";

// Hand-rolled date dialog (no library), mirroring new-vendor-dialog.tsx.
// Used by both the per-row action menu and the bulk action bar.
export function PaymentEditDateDialog({
  open,
  onOpenChange,
  initialDate,
  count = 1,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string | null;
  count?: number;
  pending?: boolean;
  onConfirm: (date: string) => void;
}) {
  // Callers mount this only while open, so state initializes fresh each time.
  const [date, setDate] = useState(initialDate ?? "");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    onConfirm(date);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(20,18,14,0.32)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fade-up w-full max-w-[420px] overflow-hidden"
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
        <div
          className="flex items-start justify-between px-[18px] py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{ background: "var(--warn-soft)", color: "var(--warn-strong)" }}
            >
              <CalendarClock className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Edit payment date</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                {count > 1
                  ? `Set a new scheduled date for ${count} payments.`
                  : "Set a new scheduled date for this payment."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-[18px] py-4">
          <div>
            <label className="micro" htmlFor="payment-date">Scheduled for</label>
            <input
              id="payment-date"
              type="date"
              required
              autoFocus
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input mt-1 w-full"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={pending || !date} className="btn btn-brand">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save date
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
