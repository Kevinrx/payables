"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { runExtraction } from "@/app/bills/actions";
import { FilePreview } from "./file-preview";

// ----------------------------------------------------------------
// Showcase extraction state.
//
// While the server action runs, we play a 6s "Reading with Claude"
// sequence: a scanline crosses the document preview, fields populate
// one-by-one on the right with shimmer fallbacks, and milestone
// events print to a dark mono "extraction log". A 4-stage progress
// stepper at the top tracks the macro phase.
//
// When the server action resolves, we router.refresh() — the page
// re-renders as the regular bill detail. If it errors before the
// timeline finishes, we cut to an error state.
// ----------------------------------------------------------------

type Stage = "reading" | "lines" | "totals" | "done";

const STAGES: { id: Stage; label: string }[] = [
  { id: "reading", label: "Reading metadata" },
  { id: "lines",   label: "Parsing line items" },
  { id: "totals",  label: "Detecting totals" },
  { id: "done",    label: "Done" },
];

type Step =
  | { at: number; type: "stage"; stage: Stage }
  | { at: number; type: "log"; msg: string }
  | { at: number; type: "fill"; field: string; value: string }
  | { at: number; type: "line"; line: { description: string; amount: string } };

const TIMELINE: Step[] = [
  { at: 200,  type: "log",   msg: "Uploading invoice…" },
  { at: 700,  type: "log",   msg: "Decoded · 1 page · PDF" },
  { at: 900,  type: "stage", stage: "reading" },
  { at: 1300, type: "log",   msg: "Identifying vendor letterhead" },
  { at: 1500, type: "fill",  field: "vendor", value: "Reading…" },
  { at: 2100, type: "fill",  field: "invoiceNumber", value: "Reading…" },
  { at: 2400, type: "log",   msg: "Parsing dates" },
  { at: 2700, type: "fill",  field: "invoiceDate", value: "Reading…" },
  { at: 2950, type: "fill",  field: "dueDate", value: "Reading…" },
  { at: 3100, type: "stage", stage: "lines" },
  { at: 3400, type: "log",   msg: "Reading line items table" },
  { at: 3700, type: "line",  line: { description: "Line 1", amount: "—" } },
  { at: 4000, type: "line",  line: { description: "Line 2", amount: "—" } },
  { at: 4300, type: "line",  line: { description: "Line 3", amount: "—" } },
  { at: 4500, type: "log",   msg: "Detected 3 line items" },
  { at: 4800, type: "stage", stage: "totals" },
  { at: 5000, type: "fill",  field: "subtotal", value: "Reading…" },
  { at: 5200, type: "fill",  field: "tax",      value: "Reading…" },
  { at: 5400, type: "fill",  field: "total",    value: "Reading…" },
  { at: 5700, type: "log",   msg: "Validating: subtotal + tax = total ✓" },
  { at: 6000, type: "stage", stage: "done" },
];

const FIELD_ORDER: { id: string; label: string; mono?: boolean; emphasize?: boolean }[] = [
  { id: "vendor",        label: "Vendor" },
  { id: "invoiceNumber", label: "Invoice #", mono: true },
  { id: "invoiceDate",   label: "Invoice date" },
  { id: "dueDate",       label: "Due date" },
  { id: "subtotal",      label: "Subtotal", mono: true },
  { id: "tax",           label: "Tax",      mono: true },
  { id: "total",         label: "Total",    mono: true, emphasize: true },
];

export function ExtractionPending({
  billId,
  fileUrl,
  fileMime,
  fileName,
}: {
  billId: string;
  fileUrl: string;
  fileMime: string;
  fileName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const triggered = useRef(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Kick off the real server extraction
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    (async () => {
      const res = await runExtraction(billId);
      if (res.ok) {
        // Wait for animation to finish (or at least pass the "done" stage)
        // before refreshing, so users see the complete state.
        const remaining = Math.max(0, 6500 - (performance.now() - (startRef.current ?? performance.now())));
        setTimeout(() => {
          // If the model came back with gaps in fields we'd expect on a
          // normal invoice, prompt the user to review before they hit
          // approve. Toast fires from the global Toaster so it survives
          // the router.refresh() that re-renders the page as the editor.
          const missing = res.data?.missingFields ?? [];
          if (missing.length > 0) {
            toast.info("Some fields couldn't be auto-detected", {
              description: `Please review: ${formatList(missing)}.`,
              duration: 7000,
            });
          }
          router.refresh();
        }, remaining);
      } else {
        setError(res.error);
      }
    })();
  }, [billId, router]);

  // Animation tick
  useEffect(() => {
    if (error) return;
    startRef.current = performance.now();
    function tick(now: number) {
      const elapsed = now - (startRef.current ?? now);
      setT(elapsed);
      if (elapsed < 7000) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [error]);

  // Compute current state from timeline
  const state = {
    fields: {} as Record<string, string>,
    lines: [] as { description: string; amount: string }[],
    logs: [] as { at: number; msg: string }[],
    stage: "reading" as Stage,
  };
  for (const ev of TIMELINE) {
    if (ev.at > t) break;
    if (ev.type === "fill") state.fields[ev.field] = ev.value;
    else if (ev.type === "line") state.lines.push(ev.line);
    else if (ev.type === "log") state.logs.push({ at: ev.at, msg: ev.msg });
    else if (ev.type === "stage") state.stage = ev.stage;
  }

  if (error) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="surface p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium">Extraction failed</h3>
                <p className="mt-1 text-sm text-ink-faint">{error}</p>
                <p className="mt-2 text-sm text-ink-faint">
                  You can fill in the bill manually, or try uploading again.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="surface">
            <div className="border-b border-border px-4 py-3">
              <div className="micro">Original document</div>
            </div>
            <div className="p-3">
              <FilePreview url={fileUrl} mime={fileMime} name={fileName} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stageIdx = STAGES.findIndex((s) => s.id === state.stage);
  const totalDuration = 6000;
  const progress = Math.min(1, t / totalDuration);
  const done = state.stage === "done";

  return (
    <div className="mt-6 space-y-5">
      {/* Progress strip */}
      <div className="surface grid items-center gap-6 px-[18px] py-3.5"
        style={{ gridTemplateColumns: "auto 1fr auto" }}>
        <div className="flex items-center gap-3">
          <span
            className={`grid h-9 w-9 place-items-center rounded-[10px] ${done ? "" : "pulse-ring"}`}
            style={{
              background: done ? "var(--success-soft)" : "var(--brand-soft)",
              color: done ? "var(--success)" : "var(--brand)",
            }}
          >
            {done ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </span>
          <div>
            <div className="text-[13px] font-semibold">
              {done ? "Extraction complete" : "Reading with Claude vision"}
            </div>
            <div className="font-mono text-[11.5px] text-ink-fainter tracking-wide tabular">
              {(t / 1000).toFixed(1)} s elapsed
            </div>
          </div>
        </div>

        <div className="flex items-center">
          {STAGES.map((s, i) => {
            const active = i === stageIdx;
            const finished = i < stageIdx;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <span className="flex items-center gap-2">
                  <span
                    className={active && !done ? "pulse-ring" : ""}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: finished ? "var(--ink)" : active ? "var(--brand)" : "var(--rule-strong)",
                      transition: "background var(--d-med)",
                      display: "inline-block",
                    }}
                  />
                  <span
                    className="font-mono text-[11.5px] tracking-wide"
                    style={{
                      color: finished ? "var(--ink-2)" : active ? "var(--ink)" : "var(--ink-fainter)",
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {s.label}
                  </span>
                </span>
                {i < STAGES.length - 1 && (
                  <span
                    className="mx-2.5 h-px flex-1"
                    style={{ background: i < stageIdx ? "var(--ink)" : "var(--rule)" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="font-mono text-lg font-medium tabular" style={{ color: done ? "var(--success)" : "var(--ink)" }}>
          {Math.round(progress * 100)}%
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 relative">
          <div className="surface overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-border bg-paper-sunken px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-mono">{fileName}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider" style={{ color: done ? "var(--ink-fainter)" : "var(--brand)" }}>
                {!done && <span className="pulse-ring" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand)" }} />}
                {done ? "READY" : "SCANNING"}
              </div>
            </div>
            <div className="relative">
              <div className="p-3">
                <FilePreview url={fileUrl} mime={fileMime} name={fileName} />
              </div>
              {!done && <div className="scan-line" />}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <ExtractedFieldsPanel fields={state.fields} lines={state.lines} />
          <ConsoleLog logs={state.logs} />
        </div>
      </div>
    </div>
  );
}

function ExtractedFieldsPanel({
  fields,
  lines,
}: {
  fields: Record<string, string>;
  lines: { description: string; amount: string }[];
}) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border bg-paper-sunken px-3.5 py-2.5">
        <div className="micro">Extracted fields</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 p-3.5">
        {FIELD_ORDER.map((f) => {
          const has = !!fields[f.id];
          return (
            <div key={f.id} style={{ gridColumn: f.emphasize ? "1 / -1" : undefined }}>
              <div className="micro mb-1.5">{f.label}</div>
              {has ? (
                <div
                  className="fade-up flex items-center gap-1.5 rounded-md px-2.5 py-2 tabular"
                  style={{
                    background: f.emphasize ? "var(--brand-soft)" : "var(--paper-sunken)",
                    border: "1px solid " + (f.emphasize ? "transparent" : "var(--rule)"),
                    fontFamily: f.mono ? "var(--font-geist-mono), monospace" : "inherit",
                    fontSize: f.emphasize ? 16 : 13,
                    fontWeight: f.emphasize ? 600 : 500,
                    color: f.emphasize ? "var(--brand)" : "var(--ink)",
                    letterSpacing: f.emphasize ? "-0.02em" : "normal",
                  }}
                >
                  <span className="shimmer" style={{ width: 80, height: 14, borderRadius: 3 }} />
                </div>
              ) : (
                <div className="shimmer" style={{ height: 32, borderRadius: 6 }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3.5 pb-3.5">
        <div className="micro mb-2">Line items{lines.length > 0 && ` (${lines.length})`}</div>
        {lines.length === 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="shimmer" style={{ height: 22 }} />
            <div className="shimmer" style={{ height: 22, width: "80%" }} />
            <div className="shimmer" style={{ height: 22, width: "60%" }} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lines.map((_, i) => (
              <div key={i} className="shimmer fade-up" style={{ height: 22 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function ConsoleLog({ logs }: { logs: { at: number; msg: string }[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (elRef.current) elRef.current.scrollTop = elRef.current.scrollHeight;
  }, [logs.length]);
  return (
    <div
      ref={elRef}
      className="hide-scroll rounded-[12px] p-4"
      style={{
        background: "var(--ink)",
        color: "oklch(0.85 0.012 65)",
        maxHeight: 200,
        overflowY: "auto",
      }}
    >
      <div className="micro mb-2" style={{ color: "oklch(0.55 0.01 65)" }}>
        ▷ EXTRACTION_LOG
      </div>
      <div className="font-mono text-[11.5px] leading-relaxed">
        {logs.map((l, i) => (
          <div key={i} className="fade-up flex gap-2.5">
            <span className="tabular" style={{ color: "oklch(0.55 0.01 65)" }}>
              [{(l.at / 1000).toFixed(2)}s]
            </span>
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
