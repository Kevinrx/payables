import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "./index";

const { bills, vendors, billLineItems, payments, billEvents } = schema;

/**
 * Single demo org. In a real product, derived from session auth.
 * We pick the most recently created org so reseed picks up the new id.
 */
export async function getDemoOrgId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .orderBy(desc(schema.organizations.createdAt))
    .limit(1);
  if (!row) {
    throw new Error("No organization found. Run `npm run db:seed`.");
  }
  return row.id;
}

export type BillListRow = Awaited<ReturnType<typeof listBills>>[number];

export async function listBills(orgId: string) {
  return db
    .select({
      id: bills.id,
      invoiceNumber: bills.invoiceNumber,
      invoiceDate: bills.invoiceDate,
      dueDate: bills.dueDate,
      totalCents: bills.totalCents,
      currency: bills.currency,
      status: bills.status,
      notes: bills.notes,
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
      vendorId: bills.vendorId,
      vendorName: vendors.name,
      parentBillId: bills.parentBillId,
    })
    .from(bills)
    .leftJoin(vendors, eq(vendors.id, bills.vendorId))
    .where(eq(bills.orgId, orgId))
    .orderBy(asc(bills.dueDate), desc(bills.createdAt));
}

export async function getBillSummary(orgId: string) {
  // Aggregate stats for the dashboard cards.
  // Excludes paid/void bills from "outstanding".
  const [row] = await db.execute<{
    overdue_count: string;
    overdue_cents: string;
    due_soon_count: string;
    due_soon_cents: string;
    scheduled_count: string;
    scheduled_cents: string;
    outstanding_count: string;
    outstanding_cents: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE status NOT IN ('paid','void') AND due_date < CURRENT_DATE
      ) AS overdue_count,
      COALESCE(SUM(total_cents) FILTER (
        WHERE status NOT IN ('paid','void') AND due_date < CURRENT_DATE
      ), 0) AS overdue_cents,
      COUNT(*) FILTER (
        WHERE status NOT IN ('paid','void')
          AND due_date >= CURRENT_DATE
          AND due_date <= CURRENT_DATE + INTERVAL '7 days'
      ) AS due_soon_count,
      COALESCE(SUM(total_cents) FILTER (
        WHERE status NOT IN ('paid','void')
          AND due_date >= CURRENT_DATE
          AND due_date <= CURRENT_DATE + INTERVAL '7 days'
      ), 0) AS due_soon_cents,
      COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
      COALESCE(SUM(total_cents) FILTER (WHERE status = 'scheduled'), 0) AS scheduled_cents,
      COUNT(*) FILTER (WHERE status NOT IN ('paid','void')) AS outstanding_count,
      COALESCE(SUM(total_cents) FILTER (WHERE status NOT IN ('paid','void')), 0) AS outstanding_cents
    FROM bills
    WHERE org_id = ${orgId}
  `);

  return {
    overdue: { count: Number(row.overdue_count), cents: Number(row.overdue_cents) },
    dueSoon: { count: Number(row.due_soon_count), cents: Number(row.due_soon_cents) },
    scheduled: { count: Number(row.scheduled_count), cents: Number(row.scheduled_cents) },
    outstanding: { count: Number(row.outstanding_count), cents: Number(row.outstanding_cents) },
  };
}

// ─── Payments (payment-centric list, mirrors listBills) ─────────────

export type PaymentListRow = Awaited<ReturnType<typeof listPayments>>[number];

export async function listPayments(orgId: string) {
  // Payments have no org_id of their own — scope through the parent bill.
  return db
    .select({
      id: payments.id,
      billId: payments.billId,
      scheduledFor: payments.scheduledFor,
      paidAt: payments.paidAt,
      method: payments.method,
      amountCents: payments.amountCents,
      status: payments.status,
      createdAt: payments.createdAt,
      vendorId: bills.vendorId,
      vendorName: vendors.name,
      invoiceNumber: bills.invoiceNumber,
      billDueDate: bills.dueDate,
      billStatus: bills.status,
      currency: bills.currency,
    })
    .from(payments)
    .innerJoin(bills, eq(bills.id, payments.billId))
    .leftJoin(vendors, eq(vendors.id, bills.vendorId))
    .where(eq(bills.orgId, orgId))
    .orderBy(asc(payments.scheduledFor), desc(payments.createdAt));
}

export async function getPaymentsSummary(orgId: string) {
  // Bucket aggregates for the Payments screen cards. Mirrors the bucketing
  // in src/lib/payments.ts (paymentBucket) so the cards agree with the tabs.
  const [row] = await db.execute<{
    needs_review_count: string;
    needs_review_cents: string;
    pending_count: string;
    pending_cents: string;
    paid_count: string;
    paid_cents: string;
    outgoing_count: string;
    outgoing_cents: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE p.status = 'failed'
           OR (p.status = 'scheduled' AND p.scheduled_for < CURRENT_DATE)
      ) AS needs_review_count,
      COALESCE(SUM(p.amount_cents) FILTER (
        WHERE p.status = 'failed'
           OR (p.status = 'scheduled' AND p.scheduled_for < CURRENT_DATE)
      ), 0) AS needs_review_cents,
      COUNT(*) FILTER (
        WHERE p.status = 'processing'
           OR (p.status = 'scheduled' AND p.scheduled_for >= CURRENT_DATE)
      ) AS pending_count,
      COALESCE(SUM(p.amount_cents) FILTER (
        WHERE p.status = 'processing'
           OR (p.status = 'scheduled' AND p.scheduled_for >= CURRENT_DATE)
      ), 0) AS pending_cents,
      COUNT(*) FILTER (WHERE p.status = 'paid') AS paid_count,
      COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0) AS paid_cents,
      COUNT(*) FILTER (WHERE p.status IN ('scheduled','processing')) AS outgoing_count,
      COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status IN ('scheduled','processing')), 0) AS outgoing_cents
    FROM payments p
    JOIN bills b ON b.id = p.bill_id
    WHERE b.org_id = ${orgId}
  `);

  return {
    needsReview: { count: Number(row.needs_review_count), cents: Number(row.needs_review_cents) },
    pending:     { count: Number(row.pending_count),      cents: Number(row.pending_cents) },
    paid:        { count: Number(row.paid_count),         cents: Number(row.paid_cents) },
    outgoing:    { count: Number(row.outgoing_count),     cents: Number(row.outgoing_cents) },
  };
}

export async function getBillById(billId: string, orgId: string) {
  const [bill] = await db
    .select({
      bill: bills,
      vendor: vendors,
    })
    .from(bills)
    .leftJoin(vendors, eq(vendors.id, bills.vendorId))
    .where(and(eq(bills.id, billId), eq(bills.orgId, orgId)))
    .limit(1);

  if (!bill) return null;

  const [lineItems, paymentRows, events] = await Promise.all([
    db
      .select()
      .from(billLineItems)
      .where(eq(billLineItems.billId, billId))
      .orderBy(asc(billLineItems.sortOrder)),
    db
      .select()
      .from(payments)
      .where(eq(payments.billId, billId))
      .orderBy(desc(payments.createdAt)),
    db
      .select()
      .from(billEvents)
      .where(eq(billEvents.billId, billId))
      .orderBy(asc(billEvents.createdAt)),
  ]);

  return {
    ...bill.bill,
    vendor: bill.vendor,
    lineItems,
    payments: paymentRows,
    events,
  };
}

export type BillDetail = NonNullable<Awaited<ReturnType<typeof getBillById>>>;

export async function listVendors(orgId: string) {
  return db
    .select()
    .from(vendors)
    .where(eq(vendors.orgId, orgId))
    .orderBy(asc(vendors.name));
}

export async function getVendorById(vendorId: string, orgId: string) {
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.orgId, orgId)))
    .limit(1);
  if (!vendor) return null;

  const vendorBills = await db
    .select({
      id: bills.id,
      invoiceNumber: bills.invoiceNumber,
      invoiceDate: bills.invoiceDate,
      dueDate: bills.dueDate,
      totalCents: bills.totalCents,
      currency: bills.currency,
      status: bills.status,
      notes: bills.notes,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .where(and(eq(bills.vendorId, vendorId), eq(bills.orgId, orgId)))
    .orderBy(asc(bills.dueDate), desc(bills.createdAt));

  const stats = vendorBills.reduce(
    (acc, b) => {
      const cents = b.totalCents ?? 0;
      if (b.status === "paid") acc.paidCents += cents;
      else if (b.status !== "void") acc.outstandingCents += cents;
      acc.byStatus[b.status] = (acc.byStatus[b.status] ?? 0) + 1;
      return acc;
    },
    {
      paidCents: 0,
      outstandingCents: 0,
      byStatus: {} as Record<string, number>,
    }
  );

  return {
    vendor,
    bills: vendorBills,
    stats: {
      ...stats,
      billCount: vendorBills.length,
    },
  };
}

export type VendorDetail = NonNullable<Awaited<ReturnType<typeof getVendorById>>>;
