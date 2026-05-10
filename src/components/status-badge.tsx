import type { BillStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<BillStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground",
  },
  needs_review: {
    label: "Needs review",
    className: "bg-info-bg text-info",
  },
  approved: {
    label: "Approved",
    className: "bg-violet-bg text-violet",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-warning-bg text-warning",
  },
  paid: {
    label: "Paid",
    className: "bg-success-bg text-success",
  },
  void: {
    label: "Void",
    className: "bg-danger-bg text-danger",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: BillStatus;
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/10",
        s.className,
        className
      )}
    >
      {s.label}
    </span>
  );
}
