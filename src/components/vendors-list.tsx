"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { NewVendorDialog } from "./new-vendor-dialog";

export type VendorRow = {
  id: string;
  name: string;
  email: string | null;
  defaultPaymentMethod: string | null;
  billCount: number;
  outstandingCents: number;
  paidCents: number;
};

export function VendorsList({ rows }: { rows: VendorRow[] }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.email?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, query]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[420px]">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--ink-fainter)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors..."
            className="input w-full"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="btn btn-brand self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          New vendor
        </button>
      </div>

      <div className="surface mt-5 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[13.5px] font-medium">
              {rows.length === 0 ? "No vendors yet" : "No vendors match your search"}
            </p>
            <p className="mt-1 text-[12px] text-ink-faint">
              {rows.length === 0
                ? "Create your first vendor or upload an invoice to add one automatically."
                : "Try a different name or email."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="text-left"
                  style={{ borderBottom: "1px solid var(--rule)", background: "var(--paper-sunken)" }}
                >
                  <th className="px-4 py-2.5 micro">Vendor</th>
                  <th className="px-4 py-2.5 text-center micro">Bills</th>
                  <th className="px-4 py-2.5 text-right micro">Outstanding</th>
                  <th className="px-4 py-2.5 text-right micro">Paid (lifetime)</th>
                  <th className="px-4 py-2.5 micro">Method</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <VendorRowItem key={v.id} v={v} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewVendorDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

function VendorRowItem({ v }: { v: VendorRow }) {
  const initials = getInitials(v.name);
  const hasPaid = v.paidCents > 0;
  const hasOutstanding = v.outstandingCents > 0;
  const detailUrl = `/vendors/${v.id}`;
  return (
    <tr
      className="group transition-colors hover:bg-paper-sunken"
      style={{ borderBottom: "1px solid var(--rule-faint)" }}
    >
      <td className="px-4 py-3">
        <Link href={detailUrl} className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 flex-none place-items-center rounded-md text-[11px] font-semibold uppercase"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              background: "var(--paper-sunken)",
              color: "var(--ink-2)",
              border: "1px solid var(--rule)",
            }}
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium group-hover:underline">
              {v.name}
            </div>
            {v.email && (
              <div className="mt-0.5 truncate text-[11.5px] text-ink-faint">{v.email}</div>
            )}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-mono tabular text-ink-2">
        {v.billCount}
      </td>
      <td
        className="px-4 py-3 text-right text-[13.5px] font-mono tabular font-semibold"
        style={{ color: hasOutstanding ? "var(--ink)" : "var(--ink-fainter)" }}
      >
        {hasOutstanding ? formatMoney(v.outstandingCents) : "—"}
      </td>
      <td
        className="px-4 py-3 text-right text-[13px] font-mono tabular"
        style={{ color: hasPaid ? "var(--success)" : "var(--ink-fainter)" }}
      >
        {formatMoney(v.paidCents)}
      </td>
      <td className="px-4 py-3">
        {v.defaultPaymentMethod ? (
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              background: "var(--paper-sunken)",
              color: "var(--ink-2)",
              border: "1px solid var(--rule)",
            }}
          >
            {v.defaultPaymentMethod}
          </span>
        ) : (
          <span className="text-[11.5px] text-ink-fainter">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <Link
          href={detailUrl}
          aria-label={`Open ${v.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-fainter transition-colors hover:bg-paper-sunken hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
