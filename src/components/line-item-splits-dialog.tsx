"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2, Wand2 } from "lucide-react";
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
    const splits = draftsToSplits(drafts);
    onSave(splits.length > 0 ? splits : null);
    onOpenChange(false);
  }

  function handleClear() {
    onSave(null);
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Allocate to categories</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description} &middot; {formatMoney(amountCents)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {drafts.map((d, i) => {
            const cents = Math.round((amountCents * (parseFloat(d.pct) || 0)) / 100);
            return (
              <div key={d.id} className="flex items-center gap-2">
                <select
                  value={d.category}
                  onChange={(e) => update(d.id, { category: e.target.value })}
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm focus:border-foreground focus:outline-none"
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
                    className="h-9 w-20 rounded-md border border-border bg-background pl-2 pr-5 text-right text-sm tabular focus:border-foreground focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground tabular">
                  {formatMoney(cents)}
                </span>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger"
                    aria-label="Remove split"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {drafts.length > 1 && i === drafts.length - 1 && (
                  <button
                    type="button"
                    onClick={() => fillRemaining(d.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Fill remaining %"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add category
            </button>
            <button
              type="button"
              onClick={distributeEvenly}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Distribute evenly
            </button>
          </div>

          <div
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
              valid
                ? "border-success/30 bg-success-bg/50 text-success"
                : "border-warning/30 bg-warning-bg/50 text-warning"
            }`}
          >
            <span>Total</span>
            <span className="tabular font-medium">
              {totalPct.toFixed(2)}% {valid ? "✓" : "(must = 100%)"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear and mark uncategorized
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-md border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
              className="h-9 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
            >
              Save split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
