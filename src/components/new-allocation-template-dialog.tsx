"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createAllocationTemplate } from "@/app/settings/actions";
import {
  SplitRowsEditor,
  type SplitDraft,
  evaluateSplitDrafts,
  toSplitDrafts,
} from "./split-rows-editor";

export function NewAllocationTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<SplitDraft[]>(() => toSplitDrafts(null));

  const { splits, valid } = useMemo(() => evaluateSplitDrafts(drafts), [drafts]);

  function reset() {
    setName("");
    setDrafts(toSplitDrafts(null));
  }

  function handleSubmit() {
    if (!name.trim() || !valid) return;
    startTransition(async () => {
      const res = await createAllocationTemplate({ name: name.trim(), splits });
      if (res.ok) {
        toast.success("Template created", { description: name.trim() });
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("Couldn't create template", { description: res.error });
      }
    });
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
        <div
          className="flex items-start justify-between px-[18px] py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
            >
              <Layers className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">New allocation template</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                A reusable split you can apply to any line item.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-[18px] py-4">
          <label className="flex flex-col gap-1">
            <span className="micro">Name</span>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing 60/40"
              className="input"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="micro">Splits</span>
            <SplitRowsEditor drafts={drafts} onChange={setDrafts} />
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t border-border px-[18px] py-3.5"
          style={{ background: "var(--paper-sunken)" }}
        >
          <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !valid}
            className="btn btn-brand"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Create template
          </button>
        </div>
      </div>
    </div>
  );
}
