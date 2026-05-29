import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BillStatus } from "@/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Vendor name → monogram ─────────────────────────────────────────

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ─── Money ──────────────────────────────────────────────────────────

export function formatMoney(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

// ─── Dates ──────────────────────────────────────────────────────────

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Today as a `YYYY-MM-DD` string. The single source of "today" for payment
 * bucketing — computed once on the server and threaded to the client so the
 * summary cards and the tab filter never disagree at a timezone boundary.
 * `en-CA` formats as ISO; respects the runtime's local timezone (UTC on the
 * server/Neon).
 */
export function currentDateIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Days from today to `dueDate`. Negative = overdue.
 * Used to compute aging buckets.
 */
export function daysUntilDue(dueDate: string | Date | null | undefined): number | null {
  if (!dueDate) return null;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Standard AP aging buckets (days overdue). "current" = not yet due.
export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export function agingBucket(dueDate: string | Date | null | undefined): AgingBucket | null {
  const days = daysUntilDue(dueDate);
  if (days === null) return null;
  const overdue = -days; // positive number = days overdue
  if (overdue <= 0) return "current";
  if (overdue <= 30) return "1-30";
  if (overdue <= 60) return "31-60";
  if (overdue <= 90) return "61-90";
  return "90+";
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

// ─── Due-state derivation ───────────────────────────────────────────
// One canonical helper for "is this bill overdue / due soon, and what
// label and color should we paint?". Paid/void bills are inert.

export type DueState = {
  days: number | null;       // signed; negative = overdue
  daysAbs: number | null;    // absolute value, or null
  isOverdue: boolean;
  isDueSoon: boolean;        // 0..7 days from due, inclusive
  label: string | null;      // "Xd overdue" | "Due today" | "in Xd"
  color: string;             // CSS var for label color
};

export function getDueState(
  dueDate: string | Date | null | undefined,
  status: BillStatus
): DueState {
  const days = daysUntilDue(dueDate);
  const inactive = status === "paid" || status === "void";
  const isOverdue = days !== null && days < 0 && !inactive;
  const isDueSoon = days !== null && days >= 0 && days <= 7 && !inactive;

  let label: string | null = null;
  if (days !== null && !inactive) {
    if (isOverdue) label = `${Math.abs(days)}d overdue`;
    else if (days === 0) label = "Due today";
    else label = `in ${days}d`;
  }

  const color = isOverdue
    ? "var(--danger-strong)"
    : isDueSoon
    ? "var(--warn-strong)"
    : "var(--ink-fainter)";

  return {
    days,
    daysAbs: days === null ? null : Math.abs(days),
    isOverdue,
    isDueSoon,
    label,
    color,
  };
}
