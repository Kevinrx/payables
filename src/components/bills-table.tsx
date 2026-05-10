"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronRight, Search, Inbox } from "lucide-react";
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
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_OPTIONS: { value: "all" | BillStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "needs_review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

type SortKey = "due" | "amount" | "vendor" | "created";

export function BillsTable({ rows }: { rows: Row[] }) {
  const [statusFilter, setStatusFilter] = useState<"all" | BillStatus>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== "all") {
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
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vendor or invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | BillStatus)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-sm focus:border-foreground focus:outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <EmptyState hasFilters={statusFilter !== "all" || search.length > 0} />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <SortableHeader
                  label="Vendor"
                  active={sortKey === "vendor"}
                  dir={sortDir}
                  onClick={() => toggleSort("vendor")}
                  className="px-4 py-2.5"
                />
                <th className="px-4 py-2.5">Invoice #</th>
                <SortableHeader
                  label="Due"
                  active={sortKey === "due"}
                  dir={sortDir}
                  onClick={() => toggleSort("due")}
                  className="px-4 py-2.5"
                />
                <SortableHeader
                  label="Amount"
                  active={sortKey === "amount"}
                  dir={sortDir}
                  onClick={() => toggleSort("amount")}
                  className="px-4 py-2.5 text-right"
                />
                <th className="px-4 py-2.5">Status</th>
                <th className="w-8 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <BillRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
        {active && <span className="sr-only">{dir}</span>}
      </button>
    </th>
  );
}

function BillRow({ row }: { row: Row }) {
  const days = daysUntilDue(row.dueDate);
  const isOverdue =
    days !== null && days < 0 && row.status !== "paid" && row.status !== "void";

  return (
    <tr className="group border-b border-border last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link href={`/bills/${row.id}`} className="block font-medium tracking-tight">
          {row.vendorName ?? <span className="text-muted-foreground">No vendor</span>}
        </Link>
        {row.notes && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.notes}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {row.invoiceNumber ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="tabular">{formatDate(row.dueDate)}</div>
        {days !== null && row.status !== "paid" && row.status !== "void" && (
          <div
            className={cn(
              "mt-0.5 text-xs",
              isOverdue ? "text-danger" : days <= 7 ? "text-warning" : "text-muted-foreground"
            )}
          >
            {isOverdue
              ? `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`
              : days === 0
              ? "Due today"
              : `in ${days} ${days === 1 ? "day" : "days"}`}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm tabular font-medium">
        {formatMoney(row.totalCents, row.currency)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <Link
          href={`/bills/${row.id}`}
          className="inline-flex opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium">
        {hasFilters ? "No bills match your filters" : "No bills yet"}
      </h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {hasFilters
          ? "Try clearing the search or status filter."
          : "Upload an invoice to get started — we'll extract the details with AI."}
      </p>
      {!hasFilters && (
        <Link
          href="/bills/new"
          className="mt-4 inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background hover:bg-foreground/85"
        >
          Upload your first invoice
        </Link>
      )}
    </div>
  );
}
