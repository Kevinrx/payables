import Link from "next/link";
import { AlertTriangle, CheckCircle2, Send, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Bucket = { count: number; cents: number };
type Summary = {
  needsReview: Bucket;
  pending: Bucket;
  paid: Bucket;
  outgoing: Bucket;
};

type Card = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bucket: Bucket;
  tone: "danger" | "warn" | "success" | "neutral";
  subtitle: string | null;
  href: string;
  big?: boolean;
};

export function PaymentSummaryCards({ summary }: { summary: Summary }) {
  const cards: Card[] = [
    {
      id: "needs_review",
      label: "Needs review",
      icon: AlertTriangle,
      bucket: summary.needsReview,
      tone: "danger",
      subtitle: summary.needsReview.count > 0 ? "Action required" : "All clear",
      href: "/payments?tab=needs_review",
    },
    {
      id: "pending",
      label: "In motion",
      icon: Send,
      bucket: summary.pending,
      tone: "warn",
      subtitle: "Pending",
      href: "/payments?tab=pending",
    },
    {
      id: "paid",
      label: "Paid",
      icon: CheckCircle2,
      bucket: summary.paid,
      tone: "success",
      subtitle: "Completed",
      href: "/payments?tab=history",
    },
    {
      id: "outgoing",
      label: "Total outgoing",
      icon: Wallet,
      bucket: summary.outgoing,
      tone: "neutral",
      subtitle: null,
      href: "/payments",
      big: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const valueColor =
          c.tone === "danger" && c.bucket.cents > 0 ? "var(--danger-strong)" :
          c.tone === "warn"   && c.bucket.cents > 0 ? "var(--warn-strong)"   :
                                                       "var(--ink)";
        const iconColor =
          c.tone === "danger"  ? "var(--danger)" :
          c.tone === "warn"    ? "var(--warn-strong)" :
          c.tone === "success" ? "var(--success)" :
                                 "var(--ink-faint)";
        const iconBg =
          c.tone === "danger"  ? "var(--danger-soft)" :
          c.tone === "warn"    ? "var(--warn-soft)" :
          c.tone === "success" ? "var(--success-soft)" :
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
                style={{ color: valueColor, fontSize: c.big ? 30 : 26, letterSpacing: "-0.025em" }}
              >
                {formatMoney(c.bucket.cents)}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-faint whitespace-nowrap">
                <span>
                  {c.bucket.count} {c.bucket.count === 1 ? "payment" : "payments"}
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
          </Link>
        );
      })}
    </div>
  );
}
