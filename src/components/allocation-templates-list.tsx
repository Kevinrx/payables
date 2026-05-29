"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { deleteAllocationTemplate } from "@/app/settings/actions";
import { formatSplitSummary, type LineItemSplit } from "@/lib/categories";
import { NewAllocationTemplateDialog } from "./new-allocation-template-dialog";

export type AllocationTemplateRow = {
  id: string;
  name: string;
  splits: LineItemSplit[];
};

export function AllocationTemplatesList({
  rows,
  canManage,
}: {
  rows: AllocationTemplateRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        formatSplitSummary(r.splits).toLowerCase().includes(q)
    );
  }, [rows, query]);

  function handleDelete(row: AllocationTemplateRow) {
    if (deletingId) return;
    setDeletingId(row.id);
    startTransition(async () => {
      const res = await deleteAllocationTemplate(row.id);
      if (res.ok) {
        toast.success("Template deleted", { description: row.name });
        router.refresh();
      } else {
        toast.error("Couldn't delete template", { description: res.error });
      }
      setDeletingId(null);
    });
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[420px]">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--ink-fainter)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates..."
            className="input w-full"
            style={{ paddingLeft: 34 }}
          />
        </div>
        {canManage && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link href="/settings/allocation-templates/import" className="btn btn-secondary">
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Link>
            <button type="button" onClick={() => setDialogOpen(true)} className="btn btn-brand">
              <Plus className="h-3.5 w-3.5" />
              New template
            </button>
          </div>
        )}
      </div>

      <div className="surface mt-5 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[13.5px] font-medium">
              {rows.length === 0 ? "No templates yet" : "No templates match your search"}
            </p>
            <p className="mt-1 text-[12px] text-ink-faint">
              {rows.length === 0
                ? "Create a reusable split or import a CSV to get started."
                : "Try a different name."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead>
                  <tr
                    className="text-left"
                    style={{ borderBottom: "1px solid var(--rule)", background: "var(--paper-sunken)" }}
                  >
                    <th className="px-4 py-2.5 micro">Template</th>
                    <th className="px-4 py-2.5 micro">Allocation</th>
                    <th className="px-4 py-2.5 text-center micro">Splits</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      style={{ borderBottom: "1px solid var(--rule-faint)" }}
                    >
                      <td className="px-4 py-3 text-[13.5px] font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-faint">
                        {formatSplitSummary(t.splits)}
                      </td>
                      <td className="px-4 py-3 text-center text-[13px] font-mono tabular text-ink-2">
                        {t.splits.length}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDelete(t)}
                            disabled={isPending}
                            className="btn-ghost grid h-7 w-7 place-items-center rounded"
                            aria-label={`Delete ${t.name}`}
                          >
                            {deletingId === t.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y sm:hidden" style={{ borderColor: "var(--rule-faint)" }}>
              {filtered.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[14px] font-medium">{t.name}</span>
                      <span className="font-mono text-[12px] tabular text-ink-faint whitespace-nowrap">
                        {t.splits.length} {t.splits.length === 1 ? "split" : "splits"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-faint">
                      {formatSplitSummary(t.splits)}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      disabled={isPending}
                      className="btn-ghost grid h-7 w-7 flex-none place-items-center rounded"
                      aria-label={`Delete ${t.name}`}
                    >
                      {deletingId === t.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {canManage && (
        <NewAllocationTemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </>
  );
}
