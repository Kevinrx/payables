import type { BillStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<BillStatus | "overdue", { label: string; cls: string }> = {
  draft:        { label: "Draft",        cls: "pill-draft" },
  needs_review: { label: "Needs review", cls: "pill-review" },
  approved:     { label: "Approved",     cls: "pill-approved" },
  scheduled:    { label: "Scheduled",    cls: "pill-scheduled" },
  paid:         { label: "Paid",         cls: "pill-paid" },
  void:         { label: "Void",         cls: "pill-void" },
  overdue:      { label: "Overdue",      cls: "pill-overdue" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: BillStatus | "overdue";
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  return <span className={cn("pill", s.cls, className)}>{s.label}</span>;
}
