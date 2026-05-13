import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import type { BillStatus } from "@/db/schema";
import { StatusBadge } from "./status-badge";
import { cn, formatDate, formatMoney, getDueState } from "@/lib/utils";

export type BillRowData = {
  id: string;
  invoiceNumber: string | null;
  dueDate: string | null;
  totalCents: number | null;
  currency: string;
  status: BillStatus;
  notes: string | null;
  vendorName: string | null;
  parentBillId: string | null;
};

// Status column is a fixed width so the grid doesn't reflow when a filter
// (e.g. "Approved" only) narrows the pill-set to shorter labels. The width
// fits the longest label ("Needs review") with breathing room.
const GRID_TEMPLATE = "minmax(0, 1.6fr) 1fr 1.2fr 1fr 116px 28px";

export function BillRow({ row }: { row: BillRowData }) {
  const due = getDueState(row.dueDate, row.status);

  return (
    <Link
      href={`/bills/${row.id}`}
      className="group relative block border-b border-border bg-surface transition-colors last:border-b-0 hover:bg-surface-hover"
    >
      {/* Overdue accent stripe — architecture, not decoration */}
      {due.isOverdue && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "var(--danger)" }}
        />
      )}

      <DesktopLayout row={row} due={due} />
      <MobileLayout row={row} due={due} />
    </Link>
  );
}

function DesktopLayout({ row, due }: { row: BillRowData; due: ReturnType<typeof getDueState> }) {
  return (
    <div
      className="hidden items-center gap-4 px-[18px] py-3.5 sm:grid"
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      <div className="min-w-0">
        <VendorCell row={row} />
        {row.notes && (
          <div className="mt-0.5 truncate text-xs text-ink-faint">{row.notes}</div>
        )}
      </div>

      <div className="font-mono text-xs text-ink-faint tabular">
        {row.invoiceNumber ?? "—"}
      </div>

      <div>
        <div className="text-[13px] tabular">{formatDate(row.dueDate)}</div>
        {due.label && (
          <div
            className="mt-0.5 font-mono text-[11.5px] tracking-tight"
            style={{ color: due.color }}
          >
            {due.label}
          </div>
        )}
      </div>

      <div className="text-right font-mono text-[14px] font-medium tabular tracking-tight">
        {formatMoney(row.totalCents, row.currency)}
      </div>

      <div>
        <StatusBadge status={due.isOverdue ? "overdue" : row.status} />
      </div>

      <div className="grid place-items-center text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

function MobileLayout({ row, due }: { row: BillRowData; due: ReturnType<typeof getDueState> }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:hidden">
      <div className="min-w-0 flex-1">
        <VendorCell row={row} />
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] tabular font-mono text-ink-faint">
          {row.invoiceNumber && (
            <>
              <span>{row.invoiceNumber}</span>
              <Sep />
            </>
          )}
          <span>{formatDate(row.dueDate)}</span>
          {due.label && (
            <>
              <Sep />
              <span style={{ color: due.color }}>{due.label}</span>
            </>
          )}
        </div>
        <div className="mt-1.5">
          <StatusBadge status={due.isOverdue ? "overdue" : row.status} />
        </div>
      </div>
      <div className="text-right font-mono text-[15px] font-medium tabular tracking-tight whitespace-nowrap">
        {formatMoney(row.totalCents, row.currency)}
      </div>
    </div>
  );
}

function VendorCell({ row }: { row: BillRowData }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className={cn(
          "truncate text-[14px] font-medium tracking-tight",
          row.vendorName ? "text-ink" : "text-ink-faint"
        )}
      >
        {row.vendorName ?? "No vendor"}
      </span>
      {row.parentBillId && (
        <span
          title="Recurring bill"
          className="grid h-4 w-4 flex-none place-items-center rounded bg-paper-sunken text-ink-faint"
        >
          <Repeat className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

function Sep() {
  return (
    <span aria-hidden style={{ color: "var(--ink-fainter)" }}>
      ·
    </span>
  );
}

export { GRID_TEMPLATE as BILL_ROW_GRID_TEMPLATE };
