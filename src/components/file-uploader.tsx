"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const FORMAT_TAGS = ["PDF", "PNG", "JPEG", "WEBP", "UP TO 10 MB"];

// Bundled sample invoices served from /public/samples/. Letting users one-click
// a known-good PDF before they upload their own avoids the "first thing I tried
// failed" demo failure mode.
const SAMPLE_INVOICES: { url: string; filename: string; label: string }[] = [
  { url: "/samples/01-acme-cloud.pdf",          filename: "01-acme-cloud.pdf",          label: "Acme Cloud" },
  { url: "/samples/02-northwind-logistics.pdf", filename: "02-northwind-logistics.pdf", label: "Northwind Logistics" },
  { url: "/samples/03-globex-supplies.pdf",     filename: "03-globex-supplies.pdf",     label: "Globex Supplies" },
];

export function FileUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  function handleFile(f: File) {
    if (!ACCEPTED_MIME.includes(f.type)) {
      toast.error(`Unsupported file type: ${f.type || "unknown"}`, {
        description: "Use PDF, PNG, JPEG, or WebP.",
      });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File is too large", { description: "Max 10 MB." });
      return;
    }
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function loadSample(sample: (typeof SAMPLE_INVOICES)[number]) {
    if (loadingSample || isPending) return;
    setLoadingSample(sample.filename);
    try {
      const res = await fetch(sample.url);
      if (!res.ok) throw new Error(`Sample fetch failed (${res.status})`);
      const blob = await res.blob();
      handleFile(new File([blob], sample.filename, { type: "application/pdf" }));
    } catch (e) {
      toast.error("Couldn't load sample", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoadingSample(null);
    }
  }

  function onSubmit() {
    if (!file) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/bills/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        toast.success("Uploaded", { description: "Extracting with Claude..." });
        router.push(`/bills/${json.billId}`);
      } catch (e) {
        toast.error("Upload failed", {
          description: e instanceof Error ? e.message : "Unknown error",
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
          background: isDragOver ? "var(--brand-soft)" : "var(--surface)",
          borderColor: isDragOver ? "var(--brand)" : "var(--rule-strong)",
        }}
      >
        <span
          className="grid h-12 w-12 place-items-center rounded-md transition-colors"
          style={{
            background: isDragOver ? "var(--surface)" : "var(--paper-sunken)",
            color: isDragOver ? "var(--brand)" : "var(--ink-2)",
            border: "1px solid var(--rule)",
          }}
        >
          <FileUp className="h-5 w-5" />
        </span>
        <p className="mt-4 text-[15px] font-semibold tracking-tight">
          Drag an invoice here, or click to browse
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
          accept={ACCEPTED_MIME.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {/* Sample chips — let reviewers try a known-good invoice in one click
          before risking a live demo on their own document. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="micro flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" style={{ color: "var(--brand)" }} />
          Or try a sample
        </span>
        {SAMPLE_INVOICES.map((s) => {
          const loading = loadingSample === s.filename;
          return (
            <button
              key={s.filename}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                loadSample(s);
              }}
              disabled={!!loadingSample || isPending}
              className="btn btn-secondary btn-sm"
              title={`Load ${s.filename}`}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileUp className="h-3 w-3" />
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      {file && (
        <div className="surface fade-up mt-3 flex items-center justify-between px-3.5 py-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{file.name}</div>
            <div
              className="text-[11.5px] tabular font-mono"
              style={{ color: "var(--ink-faint)" }}
            >
              {(file.size / 1024).toFixed(1)} KB · {file.type}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={isPending}
              className="btn btn-ghost btn-sm"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              className="btn btn-brand"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Upload &amp; extract
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
