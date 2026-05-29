"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { toast } from "sonner";
import type { PaymentListRow } from "@/db/queries";
import { cn } from "@/lib/utils";
import { paymentBucket, type PaymentAction, type PaymentBucket } from "@/lib/payments";
import { buildPaymentsCsvHref } from "@/lib/payments-csv";
import {
  cancelPayments,
  editPaymentDates,
  markPaymentsPaid,
  releasePayments,
  retryPayments,
  unschedulePayments,
} from "@/app/payments/actions";
import { PaymentRow, PAYMENT_ROW_GRID_TEMPLATE } from "./payment-row";
import { PaymentBulkBar } from "./payment-bulk-bar";

type Tab = "overview" | PaymentBucket;
type SortKey = "scheduled" | "amount" | "vendor" | "status";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "needs_review", label: "Needs review" },
  { id: "pending", label: "Pending" },
  { id: "history", label: "History" },
];
const TAB_IDS = new Set<Tab>(TABS.map((t) => t.id));

const BULK_FNS: Record<
  Exclude<PaymentAction, "editDate">,
  (ids: string[]) => Promise<{ ok: boolean; error?: string; data?: { succeeded: number; skipped: number } }>
> = {
  release: releasePayments,
  cancel: cancelPayments,
  unschedule: unschedulePayments,
  retry: retryPayments,
  markPaid: markPaymentsPaid,
};

const ACTION_VERB: Record<PaymentAction, string> = {
  release: "Released",
  cancel: "Canceled",
  unschedule: "Unscheduled",
  retry: "Retried",
  markPaid: "Marked paid",
  editDate: "Rescheduled",
};

function localToday(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

export function PaymentsList({ rows }: { rows: PaymentListRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialTab: Tab = (() => {
    const q = searchParams.get("tab");
    return q && TAB_IDS.has(q as Tab) ? (q as Tab) : "overview";
  })();
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scheduled");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const today = useMemo(() => localToday(), []);

  function setTab(next: Tab) {
    setTabState(next);
    setSelected(new Set()); // never carry a selection across tabs
  }

  // Rows in the active tab (pre-search) — selection is scoped to these.
  const tabRows = useMemo(
    () =>
      tab === "overview" ? rows : rows.filter((r) => paymentBucket(r, today) === tab),
    [rows, tab, today]
  );

  const filtered = useMemo(() => {
    let out = tabRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          (r.vendorName?.toLowerCase().includes(q) ?? false) ||
          (r.invoiceNumber?.toLowerCase().includes(q) ?? false)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "scheduled") {
        cmp = (a.scheduledFor ?? "9999-12-31").localeCompare(b.scheduledFor ?? "9999-12-31");
      } else if (sortKey === "amount") {
        cmp = a.amountCents - b.amountCents;
      } else if (sortKey === "vendor") {
        cmp = (a.vendorName ?? "~").localeCompare(b.vendorName ?? "~");
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return cmp * dir;
    });
    return out;
  }, [tabRows, search, sortKey, sortDir]);

  const selectedObjs = useMemo(
    () => tabRows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, status: r.status })),
    [tabRows, selected]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  function onSelectChange(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someVisibleSelected = filtered.some((r) => selected.has(r.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function reportResult(action: PaymentAction, res: { ok: boolean; error?: string; data?: { succeeded: number; skipped: number } }) {
    if (res.ok && res.data) {
      const { succeeded, skipped } = res.data;
      toast.success(
        `${ACTION_VERB[action]} ${succeeded} ${succeeded === 1 ? "payment" : "payments"}` +
          (skipped > 0 ? ` · ${skipped} skipped` : "")
      );
      setSelected(new Set());
      router.refresh();
    } else {
      toast.error(res.error ?? "Bulk action failed");
    }
  }

  function runBulk(action: PaymentAction, ids: string[]) {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await BULK_FNS[action as Exclude<PaymentAction, "editDate">](ids);
      reportResult(action, res);
    });
  }

  function runBulkEditDate(ids: string[], date: string) {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await editPaymentDates(ids, date);
      reportResult("editDate", res);
    });
  }

  const csvHref = useMemo(
    () =>
      buildPaymentsCsvHref(
        filtered.map((r) => ({
          vendorName: r.vendorName,
          invoiceNumber: r.invoiceNumber,
          status: r.status,
          method: r.method,
          amountCents: r.amountCents,
          scheduledFor: r.scheduledFor,
          paidAt: r.paidAt,
          billDueDate: r.billDueDate,
        }))
      ),
    [filtered]
  );

  return (
    <div className="pb-24">
      {/* Tabs + count */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:w-auto">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tab"
                data-active={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden flex-1 sm:block" />
        <a href={csvHref} download="payments.csv" className="btn btn-secondary btn-sm self-start">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      {/* Search + count */}
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-[380px] sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-fainter" />
          <input
            type="text"
            placeholder="Search vendor or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-8"
          />
        </div>
        <div className="hidden flex-1 sm:block" />
        <div className="text-xs text-ink-faint tabular sm:min-w-[72px] sm:text-right">
          {filtered.length} of {tabRows.length}
        </div>
      </div>

      {/* Table */}
      <div className="surface mt-3.5 overflow-hidden">
        <div
          className="hidden items-center gap-3 border-b border-border bg-paper-sunken px-[18px] py-2.5 sm:grid"
          style={{ gridTemplateColumns: PAYMENT_ROW_GRID_TEMPLATE }}
        >
          <SelectAllCheckbox
            checked={allVisibleSelected}
            indeterminate={!allVisibleSelected && someVisibleSelected}
            onToggle={toggleSelectAll}
          />
          <HeaderCell active={sortKey === "vendor"} dir={sortDir} onClick={() => toggleSort("vendor")}>
            Vendor
          </HeaderCell>
          <HeaderCell>Invoice #</HeaderCell>
          <HeaderCell active={sortKey === "scheduled"} dir={sortDir} onClick={() => toggleSort("scheduled")}>
            Scheduled
          </HeaderCell>
          <HeaderCell>Method</HeaderCell>
          <HeaderCell align="right" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")}>
            Amount
          </HeaderCell>
          <HeaderCell active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")}>
            Status
          </HeaderCell>
          <div />
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[13.5px] font-medium">No payments here</p>
            <p className="mt-1 text-[12px] text-ink-faint">
              {search || tab !== "overview"
                ? "Try a different tab or clear your search."
                : "Payments appear once you schedule them from an approved bill."}
            </p>
          </div>
        ) : (
          filtered.map((row) => (
            <PaymentRow
              key={row.id}
              row={row}
              selected={selected.has(row.id)}
              onSelectChange={onSelectChange}
            />
          ))
        )}
      </div>

      <PaymentBulkBar
        selected={selectedObjs}
        pending={isPending}
        onRun={runBulk}
        onEditDate={runBulkEditDate}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={(el) => {
        ref.current = el;
        if (el) el.indeterminate = indeterminate;
      }}
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      aria-label="Select all payments"
      className="h-4 w-4 flex-none cursor-pointer"
      style={{ accentColor: "var(--brand)" }}
    />
  );
}

function HeaderCell({
  children,
  active,
  dir,
  align = "left",
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  dir?: "asc" | "desc";
  align?: "left" | "right";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.09em]",
        active ? "text-ink" : "text-ink-faint",
        onClick ? "cursor-pointer" : "cursor-default",
        align === "right" && "justify-end"
      )}
    >
      {children}
      {onClick && <ArrowUpDown className={cn("h-2.5 w-2.5", active ? "opacity-100" : "opacity-40")} />}
      {active && <span className="sr-only">{dir}</span>}
    </button>
  );
}
