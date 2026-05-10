"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Wallet, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { approveBill, markBillPaid } from "@/app/bills/actions";
import { SchedulePaymentDialog } from "./schedule-payment-dialog";

export function BillActions({ bill }: { bill: BillDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const canApprove = bill.status === "needs_review" || bill.status === "draft";
  const canSchedule = bill.status === "approved";
  const canMarkPaid = bill.status === "scheduled";

  function handleApprove() {
    startTransition(async () => {
      const res = await approveBill(bill.id);
      if (res.ok) {
        toast.success("Bill approved", { description: "Ready to schedule payment." });
        router.refresh();
      } else {
        toast.error("Could not approve bill", { description: res.error });
      }
    });
  }

  function handleMarkPaid() {
    startTransition(async () => {
      const res = await markBillPaid(bill.id);
      if (res.ok) {
        toast.success("Marked as paid");
        router.refresh();
      } else {
        toast.error("Could not mark as paid", { description: res.error });
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve
          </button>
        )}
        {canSchedule && (
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
          >
            <Send className="h-4 w-4" />
            Schedule payment
          </button>
        )}
        {canMarkPaid && (
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-success px-3.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            Mark as paid
          </button>
        )}
        {bill.status === "paid" && (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-success-bg px-3.5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            Paid {bill.payments[0]?.paidAt ? new Date(bill.payments[0].paidAt).toLocaleDateString() : ""}
          </span>
        )}
      </div>

      <SchedulePaymentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        bill={bill}
      />
    </>
  );
}
