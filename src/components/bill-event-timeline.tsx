import { CheckCircle2, FilePlus, FileSearch, Pencil, Send, Wallet, XCircle } from "lucide-react";
import type { BillEventRow } from "@/db/schema";

const EVENT_DISPLAY: Record<
  BillEventRow["event"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  created: { label: "Bill created", icon: FilePlus, tone: "text-muted-foreground" },
  extracted: { label: "Extracted with AI", icon: FileSearch, tone: "text-info" },
  edited: { label: "Edited", icon: Pencil, tone: "text-muted-foreground" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "text-violet" },
  scheduled: { label: "Payment scheduled", icon: Send, tone: "text-warning" },
  paid: { label: "Paid", icon: Wallet, tone: "text-success" },
  voided: { label: "Voided", icon: XCircle, tone: "text-danger" },
};

function formatRelative(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BillEventTimeline({ events }: { events: BillEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity.</p>;
  }
  return (
    <ol className="relative space-y-4 pl-5">
      <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" aria-hidden />
      {events.map((e) => {
        const display = EVENT_DISPLAY[e.event];
        const Icon = display.icon;
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-background ${display.tone}`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="text-sm font-medium leading-tight">{display.label}</div>
            <div className="text-xs text-muted-foreground">{formatRelative(e.createdAt)}</div>
          </li>
        );
      })}
    </ol>
  );
}
