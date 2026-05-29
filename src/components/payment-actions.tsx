"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { PaymentStatus } from "@/db/schema";
import { eligibleActions, PAYMENT_ACTION_LABELS, type PaymentAction } from "@/lib/payments";
import {
  cancelPayment,
  editPaymentDate,
  markPaymentPaid,
  releasePayment,
  retryPayment,
  unschedulePayment,
} from "@/app/payments/actions";
import { PAYMENT_ACTION_ICON, DANGER_ACTIONS } from "./payment-action-meta";
import { PaymentEditDateDialog } from "./payment-edit-date-dialog";

export function PaymentActions({
  paymentId,
  status,
  scheduledFor,
}: {
  paymentId: string;
  status: PaymentStatus;
  scheduledFor: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const actions = eligibleActions(status);
  if (actions.length === 0) {
    return <span className="text-ink-fainter">—</span>;
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setOpen(false);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(`${label} done`);
        router.refresh();
      } else {
        toast.error(`Could not ${label.toLowerCase()}`, { description: res.error });
      }
    });
  }

  function handle(action: PaymentAction) {
    switch (action) {
      case "release":
        return run("Release", () => releasePayment(paymentId));
      case "markPaid":
        return run("Mark paid", () => markPaymentPaid(paymentId));
      case "unschedule":
        return run("Unschedule", () => unschedulePayment(paymentId));
      case "cancel":
        return run("Cancel", () => cancelPayment(paymentId));
      case "retry":
        return run("Retry", () => retryPayment(paymentId));
      case "editDate":
        setOpen(false);
        setDateOpen(true);
        return;
    }
  }

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label="Payment actions"
        className="btn btn-ghost btn-sm"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MoreHorizontal className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fade-up absolute right-0 top-[calc(100%+4px)] z-50 min-w-[168px] overflow-hidden py-1"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: 10,
              boxShadow: "var(--shadow-pop)",
            }}
          >
            {actions.map((a) => {
              const Icon = PAYMENT_ACTION_ICON[a];
              const danger = DANGER_ACTIONS.has(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => handle(a)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-paper-sunken"
                  style={danger ? { color: "var(--danger)" } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {PAYMENT_ACTION_LABELS[a]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {dateOpen && (
        <PaymentEditDateDialog
          open
          onOpenChange={setDateOpen}
          initialDate={scheduledFor}
          pending={isPending}
          onConfirm={(date) => {
            setDateOpen(false);
            run("Edit date", () => editPaymentDate(paymentId, date));
          }}
        />
      )}
    </div>
  );
}
