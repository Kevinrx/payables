"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export function FileUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();

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
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card px-6 py-12 text-center transition-colors ${
          isDragOver
            ? "border-foreground bg-muted"
            : "border-border hover:border-border-strong"
        }`}
      >
        <span
          className={`grid h-12 w-12 place-items-center rounded-full transition-colors ${
            isDragOver ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
          }`}
        >
          <FileUp className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-medium">
          Drop an invoice here, or <span className="text-brand">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, PNG, JPEG, or WebP &middot; up to 10 MB
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

      {file && (
        <div className="surface mt-3 flex items-center justify-between px-3.5 py-3 fade-up">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{file.name}</div>
            <div className="text-[11.5px] text-ink-faint tabular font-mono">
              {(file.size / 1024).toFixed(1)} KB · {file.type}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={isPending}
              className="btn-ghost grid h-8 w-8 place-items-center rounded-md"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
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
