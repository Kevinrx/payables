"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, Send, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Summary = {
  overdue:     { count: number; cents: number };
  dueSoon:     { count: number; cents: number };
  scheduled:   { count: number; cents: number };
  outstanding: { count: number; cents: number };
};

type Card = {
  id: "overdue" | "soon" | "scheduled" | "total";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  count: number;
  tone: "danger" | "warn" | "approve" | "neutral";
  subtitle: string | null;
  href: string;
  big?: boolean;
};

// Visual anchor of /bills: tabular mono figures, paired icon, and on the
// "Outstanding" card a sparkline showing the aging mix at a glance.
export function SummaryCards({ summary }: { summary: Summary }) {
  const cards: Card[] = [
    {
      id: "overdue",
      label: "Overdue",
      icon: AlertTriangle,
      value: summary.overdue.cents,
      count: summary.overdue.count,
      tone: "danger",
      subtitle: summary.overdue.count > 0 ? "Action required" : "All clear",
      href: "/bills?filter=overdue",
    },
    {
      id: "soon",
      label: "Due in 7 days",
      icon: CalendarClock,
      value: summary.dueSoon.cents,
      count: summary.dueSoon.count,
      tone: "warn",
      subtitle: "Pay this week",
      href: "/bills?filter=due_soon",
    },
    {
      id: "scheduled",
      label: "Scheduled",
      icon: Send,
      value: summary.scheduled.cents,
      count: summary.scheduled.count,
      tone: "approve",
      subtitle: "Outgoing",
      href: "/bills?filter=scheduled",
    },
    {
      id: "total",
      label: "Outstanding",
      icon: Wallet,
      value: summary.outstanding.cents,
      count: summary.outstanding.count,
      tone: "neutral",
      subtitle: null,
      href: "/bills",
      big: true,
    },
  ];

  const total = summary.outstanding.cents || 1;
  const overduePct = Math.round((summary.overdue.cents / total) * 100);
  const segments = [
    { id: "overdue", cents: summary.overdue.cents,   color: "var(--danger)" },
    { id: "soon",    cents: summary.dueSoon.cents,   color: "var(--warn)" },
    { id: "sched",   cents: summary.scheduled.cents, color: "var(--approve)" },
    {
      id: "rest",
      cents: Math.max(
        0,
        total - summary.overdue.cents - summary.dueSoon.cents - summary.scheduled.cents
      ),
      color: "var(--rule-strong)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const valueColor =
          c.tone === "danger" && c.value > 0 ? "var(--danger-strong)" :
          c.tone === "warn"   && c.value > 0 ? "var(--warn-strong)"   :
                                                "var(--ink)";
        const iconColor =
          c.tone === "danger"  ? "var(--danger)" :
          c.tone === "warn"    ? "var(--warn-strong)" :
          c.tone === "approve" ? "var(--approve)" :
                                 "var(--ink-faint)";
        const iconBg =
          c.tone === "danger"  ? "var(--danger-soft)" :
          c.tone === "warn"    ? "var(--warn-soft)" :
          c.tone === "approve" ? "var(--approve-soft)" :
                                 "var(--paper-sunken)";
        return (
          <Link
            key={c.id}
            href={c.href}
            className="focus-ring relative flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <div className="flex items-center justify-between">
              <span className="micro">{c.label}</span>
              <span
                className="grid h-[22px] w-[22px] place-items-center rounded-[5px]"
                style={{ color: iconColor, background: iconBg }}
              >
                <Icon className="h-3 w-3" />
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div
                className="tabular font-mono font-medium"
                style={{
                  color: valueColor,
                  fontSize: c.big ? 30 : 26,
                  letterSpacing: "-0.025em",
                }}
              >
                {formatMoney(c.value)}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-faint whitespace-nowrap">
                <span>
                  {c.count} {c.count === 1 ? "bill" : "bills"}
                </span>
                {c.subtitle && (
                  <>
                    <span
                      aria-hidden
                      className="h-[2px] w-[2px] rounded-full"
                      style={{ background: "var(--rule-strong)" }}
                    />
                    <span>{c.subtitle}</span>
                  </>
                )}
              </div>
            </div>

            {c.id === "total" && (
              <div className="flex flex-col gap-1.5">
                <div
                  className="flex h-[5px] overflow-hidden rounded-full"
                  style={{ background: "var(--paper-sunken)" }}
                >
                  {segments.map(
                    (seg) =>
                      seg.cents > 0 && (
                        <div
                          key={seg.id}
                          style={{
                            width: `${(seg.cents / total) * 100}%`,
                            background: seg.color,
                            transition: "width var(--d-med)",
                          }}
                        />
                      )
                  )}
                </div>
                <div className="flex justify-between text-[10.5px] text-ink-fainter tracking-wider font-mono">
                  <span>Aging mix</span>
                  <span className="tabular">{overduePct}% overdue</span>
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
