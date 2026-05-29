"use client";

import { useMemo } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import {
  CATEGORIES,
  DEPARTMENTS,
  GL_ACCOUNTS,
  LOCATIONS,
  MAX_SPLITS,
  TOTAL_BPS,
  bpsToPct,
  pctToBps,
  type LineItemSplit,
} from "@/lib/categories";
import { formatMoney } from "@/lib/utils";

/**
 * A single editable split row. Dimension fields are "" when unassigned (selects
 * can't hold null cleanly); they convert back to null at the LineItemSplit
 * boundary. `pct` is a free-text string so the input stays controllable mid-edit.
 */
export type SplitDraft = {
  id: string;
  category: string;
  department: string;
  glAccount: string;
  location: string;
  pct: string;
};

export function newSplitDraft(partial?: Partial<SplitDraft>): SplitDraft {
  return {
    id: crypto.randomUUID(),
    category: CATEGORIES[0],
    department: "",
    glAccount: "",
    location: "",
    pct: "0",
    ...partial,
  };
}

/** LineItemSplit[] (or null) → editable drafts. Defaults to one 100% row. */
export function toSplitDrafts(splits: LineItemSplit[] | null | undefined): SplitDraft[] {
  if (!splits || splits.length === 0) {
    return [newSplitDraft({ pct: "100" })];
  }
  return splits.map((s) =>
    newSplitDraft({
      category: s.category,
      department: s.department ?? "",
      glAccount: s.glAccount ?? "",
      location: s.location ?? "",
      pct: bpsToPct(s.percentageBps).toString(),
    })
  );
}

/** Editable drafts → LineItemSplit[] (drops empty/zero rows; "" dims → null). */
export function splitDraftsToSplits(drafts: SplitDraft[]): LineItemSplit[] {
  return drafts
    .filter((d) => d.category && d.pct)
    .map((d) => ({
      category: d.category,
      department: d.department || null,
      glAccount: d.glAccount || null,
      location: d.location || null,
      percentageBps: pctToBps(parseFloat(d.pct) || 0),
    }))
    .filter((s) => s.percentageBps > 0);
}

export function splitDraftsTotalPct(drafts: SplitDraft[]): number {
  return drafts.reduce((sum, d) => sum + (parseFloat(d.pct) || 0), 0);
}

/**
 * Derives `{ splits, valid, totalPct }` from drafts in a SINGLE pass — the
 * drafts→splits conversion runs once and validity is derived from it. Components
 * should `useMemo(() => evaluateSplitDrafts(drafts), [drafts])` and reuse the
 * result for both the save payload and the disabled/indicator state instead of
 * calling `splitDraftsToSplits` + `splitDraftsValid` separately each render.
 *
 * Validity sums the per-row basis points exactly as the server does (each row
 * converted independently via pctToBps), not the rounded float total — so the
 * client gate can never approve a split the server's bps refine would reject
 * (e.g. 33.335 + 33.335 + 33.33 floats to 100% but is 10001 bps).
 */
export function evaluateSplitDrafts(drafts: SplitDraft[]): {
  splits: LineItemSplit[];
  valid: boolean;
  totalPct: number;
} {
  const splits = splitDraftsToSplits(drafts);
  const totalPct = splitDraftsTotalPct(drafts);
  const valid =
    drafts.length > 0 &&
    drafts.length <= MAX_SPLITS &&
    drafts.every((d) => d.category && parseFloat(d.pct) > 0) &&
    splits.length === drafts.length &&
    splits.reduce((sum, s) => sum + s.percentageBps, 0) === TOTAL_BPS;
  return { splits, valid, totalPct };
}

export function splitDraftsValid(drafts: SplitDraft[]): boolean {
  return evaluateSplitDrafts(drafts).valid;
}

/**
 * Presentational multi-dimension split editor. Fully controlled: the parent owns
 * the `drafts` array and receives every mutation through `onChange`. No server
 * calls live here, so both the line-item dialog and the template dialog reuse it.
 * Pass `amountCents` to render a derived money column (line-item context); omit
 * it for template editing where no concrete amount exists.
 */
export function SplitRowsEditor({
  drafts,
  onChange,
  amountCents,
  currency,
}: {
  drafts: SplitDraft[];
  onChange: (next: SplitDraft[]) => void;
  amountCents?: number;
  currency?: string;
}) {
  const { valid, totalPct } = useMemo(() => evaluateSplitDrafts(drafts), [drafts]);
  const atMax = drafts.length >= MAX_SPLITS;
  const showMoney = typeof amountCents === "number";

  function add() {
    if (atMax) return;
    onChange([...drafts, newSplitDraft()]);
  }

  function remove(id: string) {
    onChange(drafts.filter((x) => x.id !== id));
  }

  function update(id: string, patch: Partial<SplitDraft>) {
    onChange(drafts.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function fillRemaining(id: string) {
    const others = drafts
      .filter((x) => x.id !== id)
      .reduce((sum, d) => sum + (parseFloat(d.pct) || 0), 0);
    update(id, { pct: Math.max(0, 100 - others).toFixed(2) });
  }

  function distributeEvenly() {
    const n = drafts.length;
    if (n === 0) return;
    const each = (100 / n).toFixed(4);
    onChange(drafts.map((x) => ({ ...x, pct: each })));
  }

  return (
    <div className="flex flex-col gap-2.5">
      {drafts.map((d) => {
        const cents = showMoney
          ? Math.round((amountCents! * (parseFloat(d.pct) || 0)) / 100)
          : 0;
        return (
          <div
            key={d.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-2.5"
            style={{ background: "var(--paper-sunken)" }}
          >
            {/* Row 1 — category + percentage + actions */}
            <div
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: "1fr 96px 28px 28px" }}
            >
              <select
                value={d.category}
                onChange={(e) => update(d.id, { category: e.target.value })}
                className="select"
                aria-label="Category"
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
                  aria-label="Percentage"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-fainter">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => fillRemaining(d.id)}
                className="btn-ghost grid h-7 w-7 place-items-center rounded"
                title="Fill remaining %"
              >
                <Wand2 className="h-3 w-3" />
              </button>
              {drafts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="btn-ghost grid h-7 w-7 place-items-center rounded"
                  aria-label="Remove split"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : (
                <span />
              )}
            </div>

            {/* Row 2 — additional accounting dimensions */}
            <div className="grid gap-2 sm:grid-cols-3">
              <DimensionSelect
                label="Department"
                value={d.department}
                options={DEPARTMENTS}
                onChange={(v) => update(d.id, { department: v })}
              />
              <DimensionSelect
                label="GL account"
                value={d.glAccount}
                options={GL_ACCOUNTS}
                onChange={(v) => update(d.id, { glAccount: v })}
              />
              <DimensionSelect
                label="Location"
                value={d.location}
                options={LOCATIONS}
                onChange={(v) => update(d.id, { location: v })}
              />
            </div>

            {showMoney && (
              <div className="text-right text-[12px] text-ink-faint tabular font-mono">
                {formatMoney(cents, currency)}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-0.5">
        <button
          type="button"
          onClick={add}
          disabled={atMax}
          className="btn btn-ghost btn-sm"
        >
          <Plus className="h-3 w-3" />
          Add split
        </button>
        <button type="button" onClick={distributeEvenly} className="btn btn-ghost btn-sm">
          <Wand2 className="h-3 w-3" />
          Distribute evenly
        </button>
      </div>

      {atMax && (
        <p className="text-[11.5px]" style={{ color: "var(--warn-strong)" }}>
          Maximum of {MAX_SPLITS} splits reached.
        </p>
      )}

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
  );
}

function DimensionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="micro">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select"
      >
        <option value="">— Unassigned —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
