"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getDemoOrgId } from "@/db/queries";

const { bills, payments, billEvents } = schema;

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type BillRow = typeof bills.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type Loaded = { payment: PaymentRow; bill: BillRow };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ApplyResult = { applied: true } | { applied: false; reason: string };

// ─── Lookups (org scoped through the parent bill) ───────────────────

async function findPaymentForOrg(
  paymentId: string,
  orgId: string
): Promise<Loaded | null> {
  const [row] = await db
    .select({ payment: payments, bill: bills })
    .from(payments)
    .innerJoin(bills, eq(bills.id, payments.billId))
    .where(and(eq(payments.id, paymentId), eq(bills.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

async function findPaymentsForOrg(
  paymentIds: string[],
  orgId: string
): Promise<Loaded[]> {
  if (paymentIds.length === 0) return [];
  return db
    .select({ payment: payments, bill: bills })
    .from(payments)
    .innerJoin(bills, eq(bills.id, payments.billId))
    .where(and(inArray(payments.id, paymentIds), eq(bills.orgId, orgId)));
}

// ─── Transition helpers (single source of truth for the payment FSM) ─
//
// Each runs inside the caller's transaction, checks its precondition, and
// performs the payment mutation + the bill_events row (+ any bill status
// change) atomically. Returns whether it applied so bulk callers can skip
// ineligible rows instead of failing the whole batch.

async function applyRelease(tx: Tx, p: PaymentRow): Promise<ApplyResult> {
  if (p.status !== "scheduled") {
    return { applied: false, reason: `Cannot release a ${p.status} payment` };
  }
  await tx.update(payments).set({ status: "processing" }).where(eq(payments.id, p.id));
  await tx.insert(billEvents).values({
    billId: p.billId,
    event: "released",
    payload: { paymentId: p.id },
  });
  return { applied: true };
}

async function applyCancel(
  tx: Tx,
  p: PaymentRow,
  bill: BillRow,
  action: "cancel" | "unschedule"
): Promise<ApplyResult> {
  const allowed =
    action === "unschedule"
      ? p.status === "scheduled"
      : p.status === "scheduled" || p.status === "processing" || p.status === "failed";
  if (!allowed) {
    return { applied: false, reason: `Cannot ${action} a ${p.status} payment` };
  }
  await tx.update(payments).set({ status: "canceled" }).where(eq(payments.id, p.id));
  // Return the bill to the active queue (unpaid) if it was scheduled.
  if (bill.status === "scheduled") {
    await tx
      .update(bills)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(bills.id, bill.id));
  }
  await tx.insert(billEvents).values({
    billId: p.billId,
    event: "canceled",
    payload: { paymentId: p.id, action },
  });
  return { applied: true };
}

async function applyEditDate(
  tx: Tx,
  p: PaymentRow,
  scheduledFor: string
): Promise<ApplyResult> {
  if (p.status !== "scheduled") {
    return { applied: false, reason: `Cannot reschedule a ${p.status} payment` };
  }
  await tx.update(payments).set({ scheduledFor }).where(eq(payments.id, p.id));
  await tx.insert(billEvents).values({
    billId: p.billId,
    event: "scheduled",
    payload: { paymentId: p.id, action: "rescheduled", scheduledFor },
  });
  return { applied: true };
}

async function applyRetry(tx: Tx, p: PaymentRow): Promise<ApplyResult> {
  if (p.status !== "failed") {
    return { applied: false, reason: `Cannot retry a ${p.status} payment` };
  }
  // Re-queue for today so it lands back in Pending and can release.
  const today = new Date().toISOString().slice(0, 10);
  await tx
    .update(payments)
    .set({ status: "scheduled", scheduledFor: today })
    .where(eq(payments.id, p.id));
  await tx.insert(billEvents).values({
    billId: p.billId,
    event: "scheduled",
    payload: { paymentId: p.id, action: "retried" },
  });
  return { applied: true };
}

async function applyMarkPaid(
  tx: Tx,
  p: PaymentRow,
  bill: BillRow
): Promise<ApplyResult> {
  if (p.status !== "scheduled" && p.status !== "processing") {
    return { applied: false, reason: `Cannot mark a ${p.status} payment as paid` };
  }
  await tx
    .update(payments)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(payments.id, p.id));
  if (bill.status === "scheduled") {
    await tx
      .update(bills)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(bills.id, bill.id));
  }
  await tx.insert(billEvents).values({
    billId: p.billId,
    event: "paid",
    payload: { paymentId: p.id, paidAt: new Date().toISOString() },
  });
  return { applied: true };
}

// ─── Generic single / bulk runners ──────────────────────────────────

async function runSingle(
  paymentId: string,
  apply: (tx: Tx, loaded: Loaded) => Promise<ApplyResult>
): Promise<Result> {
  try {
    const orgId = await getDemoOrgId();
    const loaded = await findPaymentForOrg(paymentId, orgId);
    if (!loaded) return { ok: false, error: "Payment not found" };

    let outcome: ApplyResult = { applied: false, reason: "Action not allowed" };
    await db.transaction(async (tx) => {
      outcome = await apply(tx, loaded);
    });
    if (!outcome.applied) return { ok: false, error: outcome.reason };

    revalidatePath("/payments");
    revalidatePath("/bills");
    revalidatePath(`/bills/${loaded.bill.id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function runBulk(
  paymentIds: string[],
  apply: (tx: Tx, loaded: Loaded) => Promise<ApplyResult>
): Promise<Result<{ succeeded: number; skipped: number }>> {
  try {
    const orgId = await getDemoOrgId();
    const loaded = await findPaymentsForOrg(paymentIds, orgId);

    let succeeded = 0;
    let skipped = 0;
    const affectedBills = new Set<string>();
    await db.transaction(async (tx) => {
      for (const item of loaded) {
        const outcome = await apply(tx, item);
        if (outcome.applied) {
          succeeded++;
          affectedBills.add(item.bill.id);
        } else {
          skipped++;
        }
      }
    });
    // ids that didn't resolve (wrong org / deleted) count as skipped too.
    skipped += paymentIds.length - loaded.length;

    revalidatePath("/payments");
    revalidatePath("/bills");
    for (const billId of affectedBills) revalidatePath(`/bills/${billId}`);
    return { ok: true, data: { succeeded, skipped } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ─── Input validation ───────────────────────────────────────────────

const idsSchema = z.array(z.string().uuid()).min(1).max(200);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// ─── Single-payment server actions ──────────────────────────────────

export async function releasePayment(paymentId: string): Promise<Result> {
  return runSingle(paymentId, (tx, { payment }) => applyRelease(tx, payment));
}

export async function cancelPayment(paymentId: string): Promise<Result> {
  return runSingle(paymentId, (tx, { payment, bill }) =>
    applyCancel(tx, payment, bill, "cancel")
  );
}

export async function unschedulePayment(paymentId: string): Promise<Result> {
  return runSingle(paymentId, (tx, { payment, bill }) =>
    applyCancel(tx, payment, bill, "unschedule")
  );
}

export async function retryPayment(paymentId: string): Promise<Result> {
  return runSingle(paymentId, (tx, { payment }) => applyRetry(tx, payment));
}

export async function markPaymentPaid(paymentId: string): Promise<Result> {
  return runSingle(paymentId, (tx, { payment, bill }) =>
    applyMarkPaid(tx, payment, bill)
  );
}

export async function editPaymentDate(
  paymentId: string,
  scheduledFor: string
): Promise<Result> {
  const parsed = dateSchema.safeParse(scheduledFor);
  if (!parsed.success) return { ok: false, error: "Invalid date" };
  return runSingle(paymentId, (tx, { payment }) =>
    applyEditDate(tx, payment, parsed.data)
  );
}

// ─── Bulk server actions ────────────────────────────────────────────

export async function releasePayments(paymentIds: string[]) {
  const parsed = idsSchema.safeParse(paymentIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid selection" };
  return runBulk(parsed.data, (tx, { payment }) => applyRelease(tx, payment));
}

export async function cancelPayments(paymentIds: string[]) {
  const parsed = idsSchema.safeParse(paymentIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid selection" };
  return runBulk(parsed.data, (tx, { payment, bill }) =>
    applyCancel(tx, payment, bill, "cancel")
  );
}

export async function unschedulePayments(paymentIds: string[]) {
  const parsed = idsSchema.safeParse(paymentIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid selection" };
  return runBulk(parsed.data, (tx, { payment, bill }) =>
    applyCancel(tx, payment, bill, "unschedule")
  );
}

export async function retryPayments(paymentIds: string[]) {
  const parsed = idsSchema.safeParse(paymentIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid selection" };
  return runBulk(parsed.data, (tx, { payment }) => applyRetry(tx, payment));
}

export async function markPaymentsPaid(paymentIds: string[]) {
  const parsed = idsSchema.safeParse(paymentIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid selection" };
  return runBulk(parsed.data, (tx, { payment, bill }) =>
    applyMarkPaid(tx, payment, bill)
  );
}

export async function editPaymentDates(paymentIds: string[], scheduledFor: string) {
  const ids = idsSchema.safeParse(paymentIds);
  const date = dateSchema.safeParse(scheduledFor);
  if (!ids.success) return { ok: false as const, error: "Invalid selection" };
  if (!date.success) return { ok: false as const, error: "Invalid date" };
  return runBulk(ids.data, (tx, { payment }) =>
    applyEditDate(tx, payment, date.data)
  );
}
