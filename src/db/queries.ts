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
