"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { PaymentStatus } from "@/db/schema";
import { canApply, PAYMENT_ACTION_LABELS, type PaymentAction } from "@/lib/payments";
import {
  PAYMENT_ACTION_ICON,
  BULK_ACTION_ORDER,
  DANGER_ACTIONS,
} from "./payment-action-meta";
import { PaymentEditDateDialog } from "./payment-edit-date-dialog";

type Selected = { id: string; status: PaymentStatus };

export function PaymentBulkBar({
  selected,
  pending,
  onRun,
  onEditDate,
  onClear,
}: {
  selected: Selected[];
  pending: boolean;
  onRun: (action: PaymentAction, ids: string[]) => void;
  onEditDate: (ids: string[], date: string) => void;
  onClear: () => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);

  if (selected.length === 0) return null;

  const eligibleIds = (action: PaymentAction) =>
    selected.filter((s) => canApply(action, s.status)).map((s) => s.id);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:bottom-5 sm:px-0">
      <div
        className="fade-up mx-auto flex max-w-[1200px] flex-wrap items-center gap-2 px-3 py-2.5"
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          borderRadius: 12,
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <span className="px-1.5 text-[13px] font-medium tabular whitespace-nowrap">
          {selected.length} selected
        </span>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}

        <div className="mx-1 hidden h-5 w-px sm:block" style={{ background: "var(--ink-faint)" }} />

        <div className="flex flex-wrap items-center gap-1.5">
          {BULK_ACTION_ORDER.map((action) => {
            const Icon = PAYMENT_ACTION_ICON[action];
            const label = PAYMENT_ACTION_LABELS[action];
            const danger = DANGER_ACTIONS.has(action);
            const count = eligibleIds(action).length;
            return (
              <button
                key={action}
                type="button"
                disabled={pending || count === 0}
                onClick={() => {
                  if (action === "editDate") setDateOpen(true);
                  else onRun(action, eligibleIds(action));
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-35"
                style={{
                  background: "color-mix(in oklch, var(--paper) 14%, transparent)",
                  color: danger ? "var(--danger-soft, #fca5a5)" : "var(--paper)",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count > 0 && <span className="tabular opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium opacity-80 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {dateOpen && (
        <PaymentEditDateDialog
          open
          onOpenChange={setDateOpen}
          count={eligibleIds("editDate").length}
          pending={pending}
          onConfirm={(date) => {
            setDateOpen(false);
            onEditDate(eligibleIds("editDate"), date);
          }}
        />
      )}
    </div>
  );
}
