"use client";

import { useEffect, useState } from "react";
import { Plus, Tag, Trash2, Wand2, X } from "lucide-react";
import {
  CATEGORIES,
  TOTAL_BPS,
  bpsToPct,
  pctToBps,
  type LineItemSplit,
} from "@/lib/categories";
import { formatMoney } from "@/lib/utils";

type Draft = { id: string; category: string; pct: string };

function toDrafts(splits: LineItemSplit[] | null | undefined): Draft[] {
  if (!splits || splits.length === 0) {
    return [{ id: crypto.randomUUID(), category: CATEGORIES[0], pct: "100" }];
  }
  return splits.map((s) => ({
    id: crypto.randomUUID(),
    category: s.category,
    pct: bpsToPct(s.percentageBps).toString(),
  }));
}

function draftsToSplits(drafts: Draft[]): LineItemSplit[] {
  return drafts
    .filter((d) => d.category && d.pct)
    .map((d) => ({ category: d.category, percentageBps: pctToBps(parseFloat(d.pct) || 0) }))
    .filter((s) => s.percentageBps > 0);
}

export function LineItemSplitsDialog({
  open,
  onOpenChange,
  description,
  amountCents,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  description: string;
  amountCents: number;
  initial: LineItemSplit[] | null | undefined;
  onSave: (splits: LineItemSplit[] | null) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(initial));

  useEffect(() => {
    if (open) setDrafts(toDrafts(initial));
  }, [open, initial]);

  const totalPct = drafts.reduce((sum, d) => sum + (parseFloat(d.pct) || 0), 0);
  const totalBps = Math.round(totalPct * 100);
  const valid = totalBps === TOTAL_BPS && drafts.every((d) => d.category && parseFloat(d.pct) > 0);

  function add() {
    setDrafts((d) => [
      ...d,
      { id: crypto.randomUUID(), category: CATEGORIES[0], pct: "0" },
    ]);
  }

  function remove(id: string) {
    setDrafts((d) => d.filter((x) => x.id !== id));
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function fillRemaining(id: string) {
    const others = drafts.filter((x) => x.id !== id).reduce((sum, d) => sum + (parseFloat(d.pct) || 0), 0);
    update(id, { pct: Math.max(0, 100 - others).toFixed(2) });
  }

  function distributeEvenly() {
    const n = drafts.length;
    if (n === 0) return;
    const each = (100 / n).toFixed(4);
    setDrafts((d) => d.map((x) => ({ ...x, pct: each })));
  }

  function handleSave() {
    if (!valid) return;
    onSave(draftsToSplits(drafts).length > 0 ? draftsToSplits(drafts) : null);
    onOpenChange(false);
  }

  function handleClear() {
    onSave(null);
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(20,18,14,0.32)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fade-up w-full max-w-[560px] overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 14,
          boxShadow: "var(--shadow-pop)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-border px-[18px] py-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper-sunken text-ink-2 flex-none">
              <Tag className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight">Allocate to categories</h2>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">
                {description} · <span className="tabular font-mono">{formatMoney(amountCents)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-ghost grid h-7 w-7 place-items-center rounded-md flex-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-[18px] py-4">
          {drafts.map((d, i) => {
            const cents = Math.round((amountCents * (parseFloat(d.pct) || 0)) / 100);
            return (
              <div key={d.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 90px 80px 28px 28px" }}>
                <select
                  value={d.category}
                  onChange={(e) => update(d.id, { category: e.target.value })}
                  className="select"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={d.pct}
                    onChange={(e) => update(d.id, { pct: e.target.value })}
                    className="input tabular font-mono pr-5"
                    style={{ textAlign: "right" }}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-fainter">
                    %
                  </span>
                </div>
                <span className="text-right text-[12px] text-ink-faint tabular font-mono">
                  {formatMoney(cents)}
                </span>
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => fillRemaining(d.id)}
                    className="btn-ghost grid h-7 w-7 place-items-center rounded"
                    title="Fill remaining %"
                    style={{ visibility: i === drafts.length - 1 ? "visible" : "hidden" }}
                  >
                    <Wand2 className="h-3 w-3" />
                  </button>
                ) : <span />}
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className="btn-ghost grid h-7 w-7 place-items-center rounded"
                    aria-label="Remove split"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : <span />}
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={add} className="btn btn-ghost btn-sm">
              <Plus className="h-3 w-3" />
              Add category
            </button>
            <button type="button" onClick={distributeEvenly} className="btn btn-ghost btn-sm">
              <Wand2 className="h-3 w-3" />
              Distribute evenly
            </button>
          </div>

          <div
            className="flex items-center justify-between rounded-md px-3 py-2 text-[12.5px]"
            style={{
              background: valid ? "var(--success-soft)" : "var(--warn-soft)",
              color: valid ? "var(--success)" : "var(--warn-strong)",
            }}
          >
            <span>Allocated</span>
            <span className="tabular font-mono font-medium">
              {totalPct.toFixed(2)}% {valid ? "✓" : "(must = 100%)"}
            </span>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-2 border-t border-border px-[18px] py-3.5"
          style={{ background: "var(--paper-sunken)" }}
        >
          <button type="button" onClick={handleClear} className="text-[11.5px] text-ink-faint hover:text-ink">
            Clear and mark uncategorized
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={!valid} className="btn btn-primary btn-sm">
              Save splits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
