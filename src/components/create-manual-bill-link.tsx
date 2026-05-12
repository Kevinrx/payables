"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createManualBill } from "@/app/bills/actions";

export function CreateManualBillCard() {
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
      className="surface focus-ring group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-sunken disabled:opacity-60"
    >
      <span
        className="grid h-8 w-8 flex-none place-items-center rounded-lg"
        style={{ background: "var(--paper-sunken)", color: "var(--ink-2)" }}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">Create a bill manually</div>
        <div className="mt-0.5 text-[12px] text-ink-faint">
          Skip the upload — enter the fields yourself.
        </div>
      </div>
      <ArrowRight
        className="h-3.5 w-3.5 flex-none transition-transform group-hover:translate-x-0.5"
        style={{ color: "var(--ink-fainter)" }}
      />
    </button>
  );
}
