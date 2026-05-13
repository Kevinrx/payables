"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { importBillsFromCsv } from "@/app/bills/actions";

// Bundled sample served from /public/samples/. Same pattern as the PDF
// chips on /bills/new — gives reviewers a known-good CSV to feel out
// the flow before bringing their own spreadsheet.
const SAMPLE_CSV = {
  url: "/samples/bulk-import.csv",
  filename: "bulk-import.csv",
  label: "8-bill sample",
};

const REQUIRED_COLUMNS = ["vendor_name", "total"] as const;
const KNOWN_COLUMNS = [
  "vendor_name",
  "invoice_number",
  "invoice_date",
  "due_date",
  "total",
  "currency",
  "notes",
] as const;
const FORMAT_TAGS = ["CSV", "UP TO 10 MB"];

type Row = {
  vendor_name: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  currency: string;
  notes: string | null;
};

type ParseResult =
  | { kind: "ok"; rows: Row[]; ignoredColumns: string[] }
  | { kind: "error"; message: string };

function normalizeRow(raw: Record<string, string>, line: number): Row | string {
  const get = (key: string) => raw[key]?.trim() || null;
  const vendor = get("vendor_name") || get("vendor");
  if (!vendor) return `line ${line}: vendor_name is required`;
  const totalRaw = get("total") || get("amount");
  if (!totalRaw) return `line ${line}: total is required`;
  const total = parseFloat(totalRaw.replace(/[$,]/g, ""));
  if (!Number.isFinite(total) || total <= 0) {
    return `line ${line}: invalid total "${totalRaw}"`;
  }
  return {
    vendor_name: vendor,
    invoice_number: get("invoice_number") || get("invoice_no") || null,
    invoice_date: get("invoice_date"),
    due_date: get("due_date"),
    total,
    currency: get("currency") || "USD",
    notes: get("notes") || null,
  };
}

export function CsvImporter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loadingSample, setLoadingSample] = useState(false);

  async function loadSample() {
    if (loadingSample || isPending) return;
    setLoadingSample(true);
    try {
      const res = await fetch(SAMPLE_CSV.url);
      if (!res.ok) throw new Error(`Sample fetch failed (${res.status})`);
      const blob = await res.blob();
      handleFile(new File([blob], SAMPLE_CSV.filename, { type: "text/csv" }));
    } catch (e) {
      toast.error("Couldn't load sample", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoadingSample(false);
    }
  }

  function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".csv") && f.type !== "text/csv") {
      toast.error("Not a CSV file");
      return;
    }
    setFile(f);
    setResult(null);
    setErrors([]);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (parsed) => {
        if (parsed.errors.length > 0) {
          setResult({ kind: "error", message: parsed.errors[0].message });
          return;
        }
        const headers = parsed.meta.fields ?? [];
        const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
        if (missing.length > 0) {
          const okWithAliases =
            !missing.includes("vendor_name") || headers.includes("vendor");
          const totalOk = !missing.includes("total") || headers.includes("amount");
          if (!okWithAliases || !totalOk) {
            setResult({
              kind: "error",
              message: `Missing required columns: ${missing.join(", ")}. Required: vendor_name, total.`,
            });
            return;
          }
        }
        const ignored = headers.filter(
          (h) =>
            !KNOWN_COLUMNS.includes(h as (typeof KNOWN_COLUMNS)[number]) &&
            h !== "vendor" &&
            h !== "amount" &&
            h !== "invoice_no"
        );
        const rows: Row[] = [];
        const errs: string[] = [];
        parsed.data.forEach((raw, i) => {
          const r = normalizeRow(raw, i + 2);
          if (typeof r === "string") errs.push(r);
          else rows.push(r);
        });
        setErrors(errs);
        if (rows.length === 0) {
          setResult({ kind: "error", message: "No valid rows in CSV." });
          return;
        }
        setResult({ kind: "ok", rows, ignoredColumns: ignored });
      },
      error: (err) => setResult({ kind: "error", message: err.message }),
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function handleSubmit() {
    if (!result || result.kind !== "ok") return;
    startTransition(async () => {
      const res = await importBillsFromCsv({ rows: result.rows });
      if (res.ok && res.data) {
        toast.success(`Imported ${res.data.created} bills`, {
          description:
            res.data.vendorsCreated > 0
              ? `Created ${res.data.vendorsCreated} new vendor${res.data.vendorsCreated === 1 ? "" : "s"} along the way.`
              : undefined,
        });
        router.push("/bills");
      } else {
        toast.error("Import failed", {
          description: res.ok ? "Unknown error" : res.error,
        });
      }
    });
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors"
        style={{
          background: dragOver ? "var(--brand-soft)" : "var(--surface)",
          borderColor: dragOver ? "var(--brand)" : "var(--rule-strong)",
        }}
      >
        <span
          className="grid h-12 w-12 place-items-center rounded-md transition-colors"
          style={{
            background: dragOver ? "var(--surface)" : "var(--paper-sunken)",
            color: dragOver ? "var(--brand)" : "var(--ink-2)",
            border: "1px solid var(--rule)",
          }}
        >
          <FileUp className="h-5 w-5" />
        </span>
        <p className="mt-4 text-[15px] font-semibold tracking-tight">
          Drag a CSV here, or click to browse
        </p>
        <p
          className="mt-2 text-[10.5px] uppercase tracking-[0.12em] tabular"
          style={{
            color: "var(--ink-fainter)",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          {FORMAT_TAGS.join(" · ")}
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {/* One-click sample CSV — mirrors the PDF chip pattern on /bills/new. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="micro flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" style={{ color: "var(--brand)" }} />
          Or try a sample
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            loadSample();
          }}
          disabled={loadingSample || isPending}
          className="btn btn-secondary btn-sm"
          title={`Load ${SAMPLE_CSV.filename}`}
        >
          {loadingSample ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileUp className="h-3 w-3" />
          )}
          {SAMPLE_CSV.label}
        </button>
      </div>

      {file && (
        <div className="surface fade-up mt-3 flex items-center justify-between px-3.5 py-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{file.name}</div>
            <div
              className="text-[11.5px] tabular font-mono"
              style={{ color: "var(--ink-faint)" }}
            >
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setResult(null);
              setErrors([]);
            }}
            className="btn btn-ghost btn-sm"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {result?.kind === "error" && (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px]"
          style={{ background: "var(--danger-soft)", color: "var(--danger-strong)" }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{result.message}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-[13px]"
          style={{ background: "var(--warn-soft, oklch(0.955 0.035 75))", color: "var(--warn-strong)" }}
        >
          <div className="font-medium">
            {errors.length} row{errors.length === 1 ? "" : "s"} skipped:
          </div>
          <ul className="mt-1 list-inside list-disc text-[12px]">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 5 && <li>… and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}

      {result?.kind === "ok" && (
        <div className="surface mt-4 overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <div>
              <h3 className="text-[13.5px] font-semibold tracking-tight">
                Preview — {result.rows.length} bill{result.rows.length === 1 ? "" : "s"} ready to import
              </h3>
              {result.ignoredColumns.length > 0 && (
                <p className="mt-0.5 text-[11.5px] text-ink-faint">
                  Ignoring unknown columns: {result.ignoredColumns.join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="btn btn-brand"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Import {result.rows.length}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead
                className="sticky top-0 backdrop-blur"
                style={{ background: "var(--paper-sunken)" }}
              >
                <tr
                  className="text-left"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                >
                  <th className="px-4 py-2 micro">Vendor</th>
                  <th className="px-4 py-2 micro">Invoice #</th>
                  <th className="px-4 py-2 micro">Due</th>
                  <th className="px-4 py-2 text-right micro">Total</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((r, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--rule-faint)" }}
                  >
                    <td className="px-4 py-2 text-[13px] font-medium">{r.vendor_name}</td>
                    <td className="px-4 py-2 text-[12.5px] font-mono tabular text-ink-faint">
                      {r.invoice_number ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[12.5px] font-mono tabular text-ink-faint">
                      {r.due_date ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] font-mono tabular font-medium">
                      ${r.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {result.rows.length > 50 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-center text-[11.5px] text-ink-faint"
                    >
                      … {result.rows.length - 50} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
