"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createManualBill } from "@/app/bills/actions";

export function CreateManualBillLink() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await createManualBill();
      if (res.ok && res.data) {
        router.push(`/bills/${res.data.billId}`);
      } else {
        toast.error("Could not create bill", {
          description: res.ok ? "No bill returned" : res.error,
        });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink disabled:opacity-60"
    >
      Or create a bill without an invoice
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ArrowRight className="h-3 w-3" />
      )}
    </button>
  );
}
