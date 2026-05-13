"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown, Search } from "lucide-react";
import type { BillStatus } from "@/db/schema";
import { BillRow, BILL_ROW_GRID_TEMPLATE, type BillRowData } from "./bill-row";
import { BillsEmptyState } from "./bills-empty-state";
import { cn, daysUntilDue } from "@/lib/utils";

type Row = BillRowData & {
  invoiceDate: string | null;
  vendorId: string | null;
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
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
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

        {/* On mobile let the chip cluster wrap to a second line (Scheduled +
            Paid were getting cut off before). Desktop still fits on one row. */}
        <div className="w-full sm:w-auto">
          <FilterChips value={statusFilter} onChange={setStatusFilter} />
        </div>

        <div className="hidden flex-1 sm:block" />
        {/* min-width + text-right pins this cell's flex-basis so the search
            bar (flex-1) and filter chips don't shift as the count text
            changes width between "10 of 10" and "3 of 10". */}
        <div className="text-xs text-ink-faint tabular sm:ml-0 sm:min-w-[72px] sm:text-right">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Table — desktop layout */}
      <div className="surface mt-3.5 overflow-hidden">
        <div
          className="hidden items-center gap-4 border-b border-border bg-paper-sunken px-[18px] py-2.5 sm:grid"
          style={{ gridTemplateColumns: BILL_ROW_GRID_TEMPLATE }}
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
          <BillsEmptyState hasFilters={statusFilter !== "all" || search.length > 0} />
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
  value: FilterId;
  onChange: (v: FilterId) => void;
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
