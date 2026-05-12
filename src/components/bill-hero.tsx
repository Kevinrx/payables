import Link from "next/link";
import { AlertTriangle, Repeat } from "lucide-react";
import type { BillDetail } from "@/db/queries";
import { StatusBadge } from "./status-badge";
import { formatDate, formatMoney, getDueState } from "@/lib/utils";

export function BillHero({ bill }: { bill: BillDetail }) {
  const due = getDueState(bill.dueDate, bill.status);
  const { isOverdue, daysAbs } = due;

  return (
    <div className="mt-3 grid grid-cols-1 gap-4 border-b border-border pb-5 sm:gap-6 sm:pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="min-w-0">
        <div className="micro mb-2">
          Bill · <span className="font-mono tabular">{bill.invoiceNumber ?? "—"}</span>
          {isOverdue && (
            <>
              <span className="mx-2 text-ink-fainter">·</span>
              <span style={{ color: "var(--danger-strong)" }}>
                {daysAbs} DAYS OVERDUE
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <h1
            className="text-[24px] font-semibold tracking-tight sm:text-[36px]"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            {bill.vendor?.name ?? (bill.source === "manual" ? "Untitled bill" : "Unmatched vendor")}
          </h1>
          <StatusBadge status={isOverdue ? "overdue" : bill.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-faint">
          <span className="tabular">Due {formatDate(bill.dueDate)}</span>
          <Dot />
          <span className="tabular">Invoiced {formatDate(bill.invoiceDate)}</span>
          {bill.vendor?.defaultPaymentMethod && (
            <>
              <Dot />
              <span className="uppercase font-mono text-[11.5px] tracking-wider">
                Pay via {bill.vendor.defaultPaymentMethod}
              </span>
            </>
          )}
          {bill.parentBillId && (
            <>
              <Dot />
              <Link
                href={`/bills/${bill.parentBillId}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                style={{ background: "var(--paper-sunken)", color: "var(--ink-2)" }}
              >
                <Repeat className="h-2.5 w-2.5" /> Recurring · view source
              </Link>
            </>
          )}
          {bill.notes && (
            <>
              <Dot />
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                style={{ background: "var(--warn-soft)", color: "var(--warn-strong)" }}
              >
                <AlertTriangle className="h-2.5 w-2.5" /> {bill.notes}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-left sm:text-right">
        <div className="micro mb-1.5">Total due</div>
        <div
          className="tabular font-mono text-[34px] sm:text-[48px]"
          style={{
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            color: isOverdue ? "var(--danger-strong)" : "var(--ink)",
          }}
        >
          {formatMoney(bill.totalCents, bill.currency)}
        </div>
        {bill.taxCents != null && bill.taxCents > 0 && (
          <div className="mt-1.5 text-[11px] uppercase tracking-wider font-mono text-ink-fainter">
            {bill.currency} · INCL. {formatMoney(bill.taxCents, bill.currency)} TAX
          </div>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      className="h-[3px] w-[3px] rounded-full"
      style={{ background: "var(--rule-strong)" }}
    />
  );
}
