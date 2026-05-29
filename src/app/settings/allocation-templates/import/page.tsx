import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AllocationTemplateCsvImporter } from "@/components/allocation-template-csv-importer";

const REQUIRED = ["template_name", "category", "percentage"];
const OPTIONAL = ["department", "gl_account", "location"];

const TEMPLATE_CSV = `template_name,category,department,gl_account,location,percentage
Marketing 60/40,Marketing,Growth,6200 · Advertising,HQ,60
Marketing 60/40,Sales,Revenue,6500 · Professional Services,HQ,40`;

export default function ImportAllocationTemplatesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <Link href="/settings/allocation-templates" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to templates
      </Link>

      <div className="mt-4">
        <span className="micro">Bulk import</span>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Import templates from CSV</h1>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-faint">
          Each row is one split line; rows sharing a template name group into a single template.
          Percentages within a template must sum to 100%.
        </p>
      </div>

      <div className="mt-6">
        <AllocationTemplateCsvImporter />
      </div>

      <div className="surface mt-5 overflow-hidden">
        <div
          className="px-4 py-2.5"
          style={{ background: "var(--paper-sunken)", borderBottom: "1px solid var(--rule)" }}
        >
          <span className="micro">Expected columns</span>
        </div>

        <div className="grid gap-2.5 px-4 py-3.5 sm:gap-3 sm:grid-cols-[120px_1fr]">
          <div
            className="text-[10.5px] uppercase tracking-[0.08em] tabular sm:pt-1.5"
            style={{ color: "var(--danger-strong)", fontFamily: "var(--font-geist-mono), monospace" }}
          >
            Required
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {REQUIRED.map((c) => (
              <ColumnPill key={c} label={c} tone="required" />
            ))}
            <p
              className="w-full text-[11.5px] sm:ml-auto sm:max-w-[280px] sm:w-auto sm:text-right"
              style={{ color: "var(--ink-faint)" }}
            >
              Rows with the same template_name group together. Category must match the chart of
              accounts; percentages must sum to 100%.
            </p>
          </div>

          <div
            className="text-[10.5px] uppercase tracking-[0.08em] tabular sm:pt-1.5"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-mono), monospace" }}
          >
            Optional
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {OPTIONAL.map((c) => (
              <ColumnPill key={c} label={c} tone="optional" />
            ))}
          </div>
        </div>

        <div className="px-4 pb-3.5" style={{ borderTop: "1px solid var(--rule-faint)" }}>
          <div
            className="mt-3 mb-2 text-[10.5px] uppercase tracking-[0.08em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
              allocation-templates.csv
            </span>
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
      </div>

      <div
        className="mt-5 flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px]"
        style={{ background: "var(--info-soft)", color: "var(--ink-2)" }}
      >
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--info)" }} />
        <p>
          We&apos;ll validate every template, then land you on a preview where you can review the
          allocations before importing. Duplicates and invalid templates are skipped.
        </p>
      </div>
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
