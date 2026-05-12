"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Repeat, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { BillDetail } from "@/db/queries";
import { approveBill, markBillPaid } from "@/app/bills/actions";
import { SchedulePaymentDialog } from "./schedule-payment-dialog";
import { RepeatBillDialog } from "./repeat-bill-dialog";

export function BillActions({ bill }: { bill: BillDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);

  const canApprove = bill.status === "needs_review" || bill.status === "draft";
  const canSchedule = bill.status === "approved";
  const canMarkPaid = bill.status === "scheduled";
  // Repeat is allowed any time the bill has the data needed; show in the
  // header so it's available even on already-paid bills (typical for AP).
  const canRepeat = bill.status !== "void";

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
      <div className="flex items-center gap-2" style={{ flexWrap: "nowrap" }}>
        {canApprove && (
          <button type="button" onClick={handleApprove} disabled={isPending} className="btn btn-brand">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </button>
        )}
        {canSchedule && (
          <button type="button" onClick={() => setScheduleOpen(true)} className="btn btn-brand">
            <Send className="h-3.5 w-3.5" />
            Schedule
          </button>
        )}
        {canMarkPaid && (
          <button type="button" onClick={handleMarkPaid} disabled={isPending} className="btn btn-success">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
            Mark as paid
          </button>
        )}
        {bill.status === "paid" && (
          <span
            className="btn btn-secondary"
            style={{ background: "var(--success-soft)", color: "var(--success)", borderColor: "transparent", cursor: "default" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid {bill.payments[0]?.paidAt ? new Date(bill.payments[0].paidAt).toLocaleDateString() : ""}
          </span>
        )}
        {canRepeat && (
          <button type="button" onClick={() => setRepeatOpen(true)} className="btn btn-secondary">
            <Repeat className="h-3.5 w-3.5" />
            Repeat
          </button>
        )}
      </div>

      <SchedulePaymentDialog open={scheduleOpen} onOpenChange={setScheduleOpen} bill={bill} />
      <RepeatBillDialog open={repeatOpen} onOpenChange={setRepeatOpen} bill={bill} />
    </>
  );
}
