"use client";

import { useState } from "react";
import { Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { createAllocationTemplate } from "@/app/settings/actions";
import { type LineItemSplit } from "@/lib/categories";
import { formatMoney } from "@/lib/utils";
import {
  SplitRowsEditor,
  type SplitDraft,
  splitDraftsToSplits,
  splitDraftsValid,
  toSplitDrafts,
} from "./split-rows-editor";

/** A saved allocation template, trimmed to what the picker needs. */
export type SplitTemplate = { id: string; name: string; splits: LineItemSplit[] };

export function LineItemSplitsDialog({
  open,
  onOpenChange,
  description,
  amountCents,
  currency,
  initial,
  templates,
  canManageTemplates,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  description: string;
  amountCents: number;
  currency?: string;
  initial: LineItemSplit[] | null | undefined;
  templates: SplitTemplate[];
  canManageTemplates: boolean;
  onSave: (splits: LineItemSplit[] | null) => void;
}) {
  const [drafts, setDrafts] = useState<SplitDraft[]>(() => toSplitDrafts(initial));
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const valid = splitDraftsValid(drafts);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) setDrafts(toSplitDrafts(t.splits));
  }

  function handleSave() {
    if (!valid) return;
    const splits = splitDraftsToSplits(drafts);
    const finalSplits = splits.length > 0 ? splits : null;

    // Saving as a template must never block applying the split to the line.
    // Fire-and-forget: the split is applied + dialog closes immediately, and the
    // (sonner) toast resolves independently — duplicate-name / cap errors only
    // surface as a toast.
    if (canManageTemplates && saveForFuture && templateName.trim() && finalSplits) {
      const name = templateName.trim();
      void createAllocationTemplate({ name, splits: finalSplits }).then((res) => {
        if (res.ok) toast.success("Template saved", { description: name });
        else toast.error("Couldn't save template", { description: res.error });
      });
    }

    onSave(finalSplits);
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
        className="fade-up flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden"
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
                {description} ·{" "}
                <span className="tabular font-mono">{formatMoney(amountCents, currency)}</span>
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

        <div className="flex flex-col gap-3 overflow-y-auto px-[18px] py-4">
          {templates.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="micro">Apply template</span>
              <select
                value=""
                onChange={(e) => {
                  applyTemplate(e.target.value);
                  e.target.value = "";
                }}
                className="select"
              >
                <option value="">Choose a saved template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <SplitRowsEditor
            drafts={drafts}
            onChange={setDrafts}
            amountCents={amountCents}
            currency={currency}
          />

          {canManageTemplates && (
            <div
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5"
              style={{ background: "var(--paper-sunken)" }}
            >
              <label className="flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={saveForFuture}
                  onChange={(e) => setSaveForFuture(e.target.checked)}
                />
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-3 w-3" style={{ color: "var(--brand)" }} />
                  Save for future use
                </span>
              </label>
              {saveForFuture && (
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. Marketing 60/40)"
                  className="input"
                />
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2 border-t border-border px-[18px] py-3.5"
          style={{ background: "var(--paper-sunken)" }}
        >
          <button
            type="button"
            onClick={handleClear}
            className="text-[11.5px] text-ink-faint hover:text-ink"
          >
            Clear and mark uncategorized
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid || (canManageTemplates && saveForFuture && !templateName.trim())}
              className="btn btn-primary btn-sm"
            >
              Save splits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
