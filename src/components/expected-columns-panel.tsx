"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

const REQUIRED = ["vendor_name", "total"];
const OPTIONAL = ["invoice_number", "invoice_date", "due_date", "currency", "notes"];

const TEMPLATE_CSV = `vendor_name,invoice_number,invoice_date,due_date,total,currency,notes
Acme Cloud Services,ACM-2026-0701,2026-07-01,2026-07-31,1416.47,USD,Net 30
Northwind Logistics,NW-99999,2026-07-05,2026-08-04,1325.48,USD,
Globex Office Supplies,GLX-771500,2026-07-10,2026-08-09,2948.10,USD,PO #4421`;

export function ExpectedColumnsPanel() {
  const [showTemplate, setShowTemplate] = useState(false);

  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setShowTemplate((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-paper-sunken"
        style={{ background: "var(--paper-sunken)", borderBottom: "1px solid var(--rule)" }}
      >
        <span className="micro">Expected columns</span>
        <span
          className="inline-flex items-center gap-1 text-[12px] font-medium"
          style={{ color: "var(--ink-2)" }}
        >
          <ChevronRight
            className="h-3 w-3 transition-transform"
            style={{ transform: showTemplate ? "rotate(90deg)" : "none" }}
          />
          {showTemplate ? "Hide template" : "Show template"}
        </span>
      </button>

      <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-[120px_1fr]">
        <div
          className="text-[10.5px] uppercase tracking-[0.08em] tabular pt-1.5"
          style={{
            color: "var(--danger-strong)",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          Required
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REQUIRED.map((c) => (
            <ColumnPill key={c} label={c} tone="required" />
          ))}
          <p
            className="ml-auto max-w-[260px] text-right text-[11.5px]"
            style={{ color: "var(--ink-faint)" }}
          >
            Vendor name is matched to existing vendors. Total is parsed as USD unless currency is
            set.
          </p>
        </div>

        <div
          className="text-[10.5px] uppercase tracking-[0.08em] tabular pt-1.5"
          style={{
            color: "var(--ink-faint)",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          Optional
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {OPTIONAL.map((c) => (
            <ColumnPill key={c} label={c} tone="optional" />
          ))}
        </div>

        <div
          className="text-[10.5px] uppercase tracking-[0.08em] tabular pt-1.5"
          style={{
            color: "var(--ink-faint)",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          Aliases
        </div>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
          style={{ color: "var(--ink-faint)" }}
        >
          <AliasPair from="vendor" to="vendor_name" />
          <AliasPair from="amount" to="total" />
          <AliasPair from="invoice_no" to="invoice_number" />
        </div>
      </div>

      {showTemplate && (
        <div
          className="fade-up px-4 pb-3.5"
          style={{ borderTop: "1px solid var(--rule-faint)" }}
        >
          <div
            className="mt-3 mb-2 text-[10.5px] uppercase tracking-[0.08em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span style={{ fontFamily: "var(--font-geist-mono), monospace" }}>bills.csv</span>
          </div>
          <pre
            className="overflow-x-auto rounded-md p-3 font-mono text-[11.5px]"
            style={{
              background: "var(--paper-sunken)",
              color: "var(--ink-2)",
              border: "1px solid var(--rule-faint)",
            }}
          >
            {TEMPLATE_CSV}
          </pre>
        </div>
      )}
    </div>
  );
}

function ColumnPill({ label, tone }: { label: string; tone: "required" | "optional" }) {
  const isRequired = tone === "required";
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-[11.5px]"
      style={{
        fontFamily: "var(--font-geist-mono), monospace",
        background: isRequired ? "var(--danger-soft)" : "var(--paper-sunken)",
        color: isRequired ? "var(--danger-strong)" : "var(--ink-2)",
        border: `1px solid ${isRequired ? "transparent" : "var(--rule)"}`,
      }}
    >
      {label}
    </span>
  );
}

function AliasPair({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code
        className="rounded px-1 py-0.5"
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          background: "var(--paper-sunken)",
          color: "var(--ink-2)",
        }}
      >
        {from}
      </code>
      <span style={{ color: "var(--ink-fainter)" }}>→</span>
      <code
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          color: "var(--ink-2)",
        }}
      >
        {to}
      </code>
    </span>
  );
}
