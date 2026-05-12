"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  ChevronRight,
  Search,
  Inbox,
  Repeat,
} from "lucide-react";
import type { BillStatus } from "@/db/schema";
import { StatusBadge } from "./status-badge";
import { cn, daysUntilDue, formatDate, formatMoney } from "@/lib/utils";

type Row = {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalCents: number | null;
  currency: string;
  status: BillStatus;
  notes: string | null;
  vendorId: string | null;
  vendorName: string | null;
  parentBillId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SortKey = "due" | "amount" | "vendor" | "created";

const STATUS_FILTERS: { id: "all" | BillStatus | "overdue" | "due_soon"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "needs_review", label: "Needs review" },
  { id: "approved", label: "Approved" },
  { id: "scheduled", label: "Scheduled" },
  { id: "paid", label: "Paid" },
];

type FilterId = (typeof STATUS_FILTERS)[number]["id"];

const FILTER_IDS = new Set<FilterId>(STATUS_FILTERS.map((s) => s.id));

export function BillsTable({ rows }: { rows: Row[] }) {
  const searchParams = useSearchParams();
  const initialStatus: FilterId = (() => {
    const q = searchParams.get("status");
    return q && FILTER_IDS.has(q as FilterId) ? (q as FilterId) : "all";
  })();
  const [statusFilter, setStatusFilter] = useState<FilterId>(initialStatus);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter === "overdue") {
      out = out.filter((r) => {
        const d = daysUntilDue(r.dueDate);
        return d !== null && d < 0 && r.status !== "paid" && r.status !== "void";
      });
    } else if (statusFilter === "due_soon") {
      out = out.filter((r) => {
        const d = daysUntilDue(r.dueDate);
        return d !== null && d >= 0 && d <= 7 && r.status !== "paid" && r.status !== "void";
      });
    } else if (statusFilter !== "all") {
      out = out.filter((r) => r.status === statusFilter);
    }
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
      if (sortKey === "due") {
        const ad = a.dueDate ?? "9999-12-31";
        const bd = b.dueDate ?? "9999-12-31";
        cmp = ad.localeCompare(bd);
      } else if (sortKey === "amount") {
        cmp = (a.totalCents ?? 0) - (b.totalCents ?? 0);
      } else if (sortKey === "vendor") {
        cmp = (a.vendorName ?? "~").localeCompare(b.vendorName ?? "~");
      } else if (sortKey === "created") {
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      }
      return cmp * dir;
    });
    return out;
  }, [rows, statusFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  return (
    <div>
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[380px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-fainter" />
          <input
            type="text"
            placeholder="Search vendor or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-8"
          />
        </div>

        <FilterChips value={statusFilter} onChange={setStatusFilter} />

        <div className="flex-1" />
        <div className="text-xs text-ink-faint tabular">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="surface mt-3.5 overflow-hidden">
        <div
          className="grid items-center gap-4 border-b border-border bg-paper-sunken px-[18px] py-2.5"
          style={{ gridTemplateColumns: "minmax(0, 1.6fr) 1fr 1.2fr 1fr auto 28px" }}
        >
          <HeaderCell active={sortKey === "vendor"} dir={sortDir} onClick={() => toggleSort("vendor")}>
            Vendor
          </HeaderCell>
          <HeaderCell>Invoice #</HeaderCell>
          <HeaderCell active={sortKey === "due"} dir={sortDir} onClick={() => toggleSort("due")}>
            Due
          </HeaderCell>
          <HeaderCell
            align="right"
            active={sortKey === "amount"}
            dir={sortDir}
            onClick={() => toggleSort("amount")}
          >
            Amount
          </HeaderCell>
          <HeaderCell>Status</HeaderCell>
          <div />
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasFilters={statusFilter !== "all" || search.length > 0} />
        ) : (
          filtered.map((row) => <BillRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function FilterChips({
  value,
  onChange,
}: {
  value: typeof STATUS_FILTERS[number]["id"];
  onChange: (v: typeof STATUS_FILTERS[number]["id"]) => void;
}) {
  return (
    <div className="tabs">
      {STATUS_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className="tab"
          data-active={value === f.id}
          onClick={() => onChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
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
      {onClick && (
        <ArrowUpDown className={cn("h-2.5 w-2.5", active ? "opacity-100" : "opacity-40")} />
      )}
      {active && <span className="sr-only">{dir}</span>}
    </button>
  );
}

function BillRow({ row }: { row: Row }) {
  const days = daysUntilDue(row.dueDate);
  const isOverdue = days !== null && days < 0 && row.status !== "paid" && row.status !== "void";
  const isDueSoon =
    days !== null && days >= 0 && days <= 7 && row.status !== "paid" && row.status !== "void";

  return (
    <Link
      href={`/bills/${row.id}`}
      className="group relative grid items-center gap-4 border-b border-border bg-surface px-[18px] py-3.5 transition-colors last:border-b-0 hover:bg-surface-hover"
      style={{ gridTemplateColumns: "minmax(0, 1.6fr) 1fr 1.2fr 1fr auto 28px" }}
    >
      {/* Overdue accent stripe — architecture, not decoration */}
      {isOverdue && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "var(--danger)" }}
        />
      )}

      <div className="min-w-0">
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
              className="grid h-4 w-4 place-items-center rounded bg-paper-sunken text-ink-faint flex-none"
            >
              <Repeat className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        {row.notes && (
          <div className="mt-0.5 truncate text-xs text-ink-faint">{row.notes}</div>
        )}
      </div>

      <div className="font-mono text-xs text-ink-faint tabular">
        {row.invoiceNumber ?? "—"}
      </div>

      <div>
        <div className="text-[13px] tabular">{formatDate(row.dueDate)}</div>
        {days !== null && row.status !== "paid" && row.status !== "void" && (
          <div
            className="mt-0.5 font-mono text-[11.5px] tracking-tight"
            style={{
              color: isOverdue
                ? "var(--danger-strong)"
                : isDueSoon
                ? "var(--warn-strong)"
                : "var(--ink-fainter)",
            }}
          >
            {isOverdue
              ? `${Math.abs(days)}d overdue`
              : days === 0
              ? "Due today"
              : `in ${days}d`}
          </div>
        )}
      </div>

      <div className="text-right font-mono text-[14px] font-medium tabular tracking-tight">
        {formatMoney(row.totalCents, row.currency)}
      </div>

      <div>
        <StatusBadge status={isOverdue ? "overdue" : row.status} />
      </div>

      <div className="grid place-items-center text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-paper-sunken text-ink-faint">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium">
        {hasFilters ? "No bills match your filters" : "No bills yet"}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-ink-faint">
        {hasFilters
          ? "Try clearing the search or status filter."
          : "Upload an invoice to get started — we'll extract the details with AI."}
      </p>
      {!hasFilters && (
        <Link href="/bills/new" className="btn btn-brand mt-4">
          Upload your first invoice
        </Link>
      )}
    </div>
  );
}
