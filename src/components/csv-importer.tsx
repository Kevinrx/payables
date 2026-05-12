"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { importBillsFromCsv } from "@/app/bills/actions";

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
          // Allow `vendor` as alias for vendor_name, `amount` for total
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
        const ignored = headers.filter((h) => !KNOWN_COLUMNS.includes(h as (typeof KNOWN_COLUMNS)[number]) && h !== "vendor" && h !== "amount" && h !== "invoice_no");
        const rows: Row[] = [];
        const errs: string[] = [];
        parsed.data.forEach((raw, i) => {
          const r = normalizeRow(raw, i + 2); // +2 because of header + 0-index
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
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-foreground bg-muted"
            : "border-border hover:border-border-strong"
        }`}
      >
        <span
          className={`grid h-12 w-12 place-items-center rounded-full transition-colors ${
            dragOver ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
          }`}
        >
          <FileUp className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-medium">
          Drop a CSV here, or <span className="text-brand">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Required columns: <code>vendor_name</code>, <code>total</code>. Optional:{" "}
          <code>invoice_number</code>, <code>invoice_date</code>, <code>due_date</code>,{" "}
          <code>currency</code>, <code>notes</code>.
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

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card px-3.5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setResult(null);
              setErrors([]);
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {result?.kind === "error" && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-bg/60 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{result.message}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/20 bg-warning-bg/60 px-4 py-3 text-sm text-warning">
          <div className="font-medium">{errors.length} row{errors.length === 1 ? "" : "s"} skipped:</div>
          <ul className="mt-1 list-inside list-disc text-xs">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 5 && <li>… and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}

      {result?.kind === "ok" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-medium">
                Preview — {result.rows.length} bill{result.rows.length === 1 ? "" : "s"} ready to import
              </h3>
              {result.ignoredColumns.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
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
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 font-medium">{r.vendor_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.invoice_number ?? "—"}</td>
                    <td className="px-4 py-2 tabular text-muted-foreground">{r.due_date ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular font-medium">
                      ${r.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {result.rows.length > 50 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-center text-xs text-muted-foreground">
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
