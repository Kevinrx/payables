import { AlertTriangle, CalendarClock, Calendar, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Summary = {
  overdue: { count: number; cents: number };
  dueSoon: { count: number; cents: number };
  scheduled: { count: number; cents: number };
  outstanding: { count: number; cents: number };
};

type CardSpec = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  count: number;
  tone: "danger" | "warning" | "info" | "neutral";
};

const TONE_STYLES: Record<CardSpec["tone"], { ring: string; iconBg: string; iconFg: string }> = {
  danger: {
    ring: "ring-red-100",
    iconBg: "bg-danger-bg",
    iconFg: "text-danger",
  },
  warning: {
    ring: "ring-amber-100",
    iconBg: "bg-warning-bg",
    iconFg: "text-warning",
  },
  info: {
    ring: "ring-violet-100",
    iconBg: "bg-violet-bg",
    iconFg: "text-violet",
  },
  neutral: {
    ring: "ring-stone-100",
    iconBg: "bg-muted",
    iconFg: "text-muted-foreground",
  },
};

export function SummaryCards({ summary }: { summary: Summary }) {
  const cards: CardSpec[] = [
    {
      label: "Overdue",
      icon: AlertTriangle,
      value: summary.overdue.cents,
      count: summary.overdue.count,
      tone: "danger",
    },
    {
      label: "Due in 7 days",
      icon: CalendarClock,
      value: summary.dueSoon.cents,
      count: summary.dueSoon.count,
      tone: "warning",
    },
    {
      label: "Scheduled",
      icon: Calendar,
      value: summary.scheduled.cents,
      count: summary.scheduled.count,
      tone: "info",
    },
    {
      label: "Total outstanding",
      icon: Wallet,
      value: summary.outstanding.cents,
      count: summary.outstanding.count,
      tone: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const tone = TONE_STYLES[c.tone];
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
              <span className={`grid h-7 w-7 place-items-center rounded-md ${tone.iconBg} ${tone.iconFg}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular tracking-tight">
                {formatMoney(c.value)}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.count} {c.count === 1 ? "bill" : "bills"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
