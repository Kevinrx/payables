import type { PaymentStatus } from "@/db/schema";

// ─── Tab bucketing ──────────────────────────────────────────────────
//
// The Payments screen mirrors Ramp's four views. Three of them are
// derived buckets (Overview is "all"); membership is computed from a
// payment's status + whether a scheduled payment is stale (should have
// released by now). Pure so it's unit-testable and shared by the table.

export type PaymentBucket = "needs_review" | "pending" | "history";

/**
 * Map a payment to its tab bucket. `todayIso` is the local YYYY-MM-DD the
 * caller considers "today" (passed in so this stays pure).
 *
 *  - Needs Review: failed payments + scheduled payments past their date
 *  - Pending:      processing + scheduled payments dated today/future
 *  - History:      paid + canceled
 */
export function paymentBucket(
  p: { status: PaymentStatus; scheduledFor: string | null },
  todayIso: string
): PaymentBucket {
  switch (p.status) {
    case "paid":
    case "canceled":
      return "history";
    case "failed":
      return "needs_review";
    case "processing":
      return "pending";
    case "scheduled":
      // ISO date strings compare lexicographically. A scheduled payment
      // whose date has passed should have released — surface it for triage.
      if (p.scheduledFor && p.scheduledFor < todayIso) return "needs_review";
      return "pending";
  }
}

// ─── Summary (derived from the SAME rows + bucket rule as the tabs) ──
//
// Computed in JS from listPayments rows rather than a second SQL query, so
// the cards and the tabs can never disagree on "today" or the bucket rule.

type SummarizableRow = {
  status: PaymentStatus;
  scheduledFor: string | null;
  amountCents: number;
};

type SummaryBucket = { count: number; cents: number };
export type PaymentsSummary = {
  needsReview: SummaryBucket;
  pending: SummaryBucket;
  paid: SummaryBucket;
  outgoing: SummaryBucket;
};

export function summarizePayments(
  rows: SummarizableRow[],
  todayIso: string
): PaymentsSummary {
  const summary: PaymentsSummary = {
    needsReview: { count: 0, cents: 0 },
    pending: { count: 0, cents: 0 },
    paid: { count: 0, cents: 0 },
    outgoing: { count: 0, cents: 0 },
  };
  for (const r of rows) {
    const bucket = paymentBucket(r, todayIso);
    if (bucket === "needs_review") {
      summary.needsReview.count++;
      summary.needsReview.cents += r.amountCents;
    } else if (bucket === "pending") {
      summary.pending.count++;
      summary.pending.cents += r.amountCents;
    }
    if (r.status === "paid") {
      summary.paid.count++;
      summary.paid.cents += r.amountCents;
    }
    if (r.status === "scheduled" || r.status === "processing") {
      summary.outgoing.count++;
      summary.outgoing.cents += r.amountCents;
    }
  }
  return summary;
}

// ─── Status display ─────────────────────────────────────────────────

export const PAYMENT_STATUS_DISPLAY: Record<
  PaymentStatus,
  { label: string; cls: string }
> = {
  scheduled:  { label: "Scheduled",  cls: "pill-scheduled" },
  processing: { label: "Processing", cls: "pill-processing" },
  paid:       { label: "Paid",       cls: "pill-paid" },
  failed:     { label: "Failed",     cls: "pill-failed" },
  canceled:   { label: "Canceled",   cls: "pill-canceled" },
};

// ─── Action eligibility (single source of truth for affordances) ────
//
// Both the per-row menu and the bulk bar render actions from this map;
// the server independently re-checks the FSM before mutating. Keep this
// aligned with src/app/payments/actions.ts.

export type PaymentAction =
  | "release"
  | "cancel"
  | "unschedule"
  | "editDate"
  | "retry"
  | "markPaid";

export const PAYMENT_ACTION_LABELS: Record<PaymentAction, string> = {
  release: "Release",
  cancel: "Cancel",
  unschedule: "Unschedule",
  editDate: "Edit date",
  retry: "Retry",
  markPaid: "Mark paid",
};

export function eligibleActions(status: PaymentStatus): PaymentAction[] {
  switch (status) {
    case "scheduled":
      return ["release", "markPaid", "editDate", "unschedule", "cancel"];
    case "processing":
      return ["markPaid", "cancel"];
    case "failed":
      return ["retry", "cancel"];
    case "paid":
    case "canceled":
      return [];
  }
}

export function canApply(action: PaymentAction, status: PaymentStatus): boolean {
  return eligibleActions(status).includes(action);
}
