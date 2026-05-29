import { CheckCircle2, FilePlus, FileSearch, Pencil, Send, Truck, Wallet, XCircle } from "lucide-react";
import type { BillEventRow } from "@/db/schema";

const EVENT_DISPLAY: Record<
  BillEventRow["event"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  created:   { label: "Bill created",       icon: FilePlus,    tone: "var(--ink-faint)" },
  extracted: { label: "Extracted with AI",  icon: FileSearch,  tone: "var(--info)" },
  edited:    { label: "Edited",             icon: Pencil,      tone: "var(--ink-faint)" },
  approved:  { label: "Approved",           icon: CheckCircle2, tone: "var(--approve, var(--success))" },
  scheduled: { label: "Payment scheduled",  icon: Send,        tone: "var(--warn-strong, var(--brand))" },
  paid:      { label: "Paid",               icon: Wallet,      tone: "var(--success)" },
  voided:    { label: "Voided",             icon: XCircle,     tone: "var(--danger)" },
  released:  { label: "Payment released",   icon: Truck,       tone: "var(--info)" },
  canceled:  { label: "Payment canceled",   icon: XCircle,     tone: "var(--danger)" },
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
    return <p className="text-[13px] text-ink-faint">No activity.</p>;
  }
  return (
    <ol className="relative space-y-3.5 pl-6">
      <span
        className="absolute top-1 bottom-1 w-px"
        style={{ left: "8px", background: "var(--rule)" }}
        aria-hidden
      />
      {events.map((e) => {
        const display = EVENT_DISPLAY[e.event];
        const Icon = display.icon;
        return (
          <li key={e.id} className="relative">
            <span
              className="absolute grid place-items-center rounded-full"
              style={{
                left: "-24px",
                top: "1px",
                height: "16px",
                width: "16px",
                background: "var(--paper)",
                border: "1px solid var(--rule)",
                color: display.tone,
              }}
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="text-[13px] font-medium leading-tight">{display.label}</div>
            <div className="mt-0.5 text-[11.5px] text-ink-faint">{formatRelative(e.createdAt)}</div>
          </li>
        );
      })}
    </ol>
  );
}
