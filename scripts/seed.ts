/**
 * Seed the demo database with realistic AP data.
 * Run with: npm run db:seed
 *
 * Idempotent-ish: drops all rows first (NOT for production).
 */
import "./load-env";
import { db, schema } from "../src/db";
import { sql } from "drizzle-orm";

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  console.log("Wiping existing data...");
  // Order matters: children before parents due to FKs.
  await db.execute(sql`TRUNCATE TABLE bill_events, payments, bill_line_items, bills, vendors, organizations RESTART IDENTITY CASCADE`);

  console.log("Inserting organization...");
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Trashlab" })
    .returning();

  console.log("Inserting vendors...");
  const vendorRows = await db
    .insert(schema.vendors)
    .values([
      { orgId: org.id, name: "Acme Cloud Services", email: "billing@acmecloud.com", defaultPaymentMethod: "ach" },
      { orgId: org.id, name: "Northwind Logistics", email: "ap@northwind.co", defaultPaymentMethod: "ach" },
      { orgId: org.id, name: "Globex Office Supplies", email: "invoices@globex.com", defaultPaymentMethod: "check" },
      { orgId: org.id, name: "Initech Software", email: "billing@initech.io", defaultPaymentMethod: "ach" },
      { orgId: org.id, name: "Hooli Cloud", email: "ap@hooli.com", defaultPaymentMethod: "ach" },
      { orgId: org.id, name: "Pied Piper Hosting", email: "billing@piedpiper.com", defaultPaymentMethod: "card" },
      { orgId: org.id, name: "Vandelay Industries", email: "ap@vandelay.com", defaultPaymentMethod: "check" },
    ])
    .returning();

  const v = Object.fromEntries(vendorRows.map((r) => [r.name, r]));

  console.log("Inserting bills + line items + payments + events...");

  type LineItem = { description: string; quantity: number; unitPriceCents: number };
  type SeedBill = {
    vendor: keyof typeof v;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    status: typeof schema.billStatus.enumValues[number];
    notes?: string;
    lines: LineItem[];
    paid?: { method: typeof schema.paymentMethod.enumValues[number]; daysAgo: number };
    scheduled?: { method: typeof schema.paymentMethod.enumValues[number]; inDays: number };
  };

  const seedBills: SeedBill[] = [
    {
      vendor: "Acme Cloud Services",
      invoiceNumber: "ACM-2026-0418",
      invoiceDate: daysFromNow(-12),
      dueDate: daysFromNow(18),
      status: "needs_review",
      notes: "Q2 compute usage",
      lines: [
        { description: "Compute hours - production", quantity: 720, unitPriceCents: 145 },
        { description: "Egress bandwidth (GB)", quantity: 1850, unitPriceCents: 9 },
        { description: "Object storage (TB-month)", quantity: 4, unitPriceCents: 2300 },
      ],
    },
    {
      vendor: "Northwind Logistics",
      invoiceNumber: "NW-99841",
      invoiceDate: daysFromNow(-3),
      dueDate: daysFromNow(27),
      status: "draft",
      lines: [
        { description: "Same-day courier (April)", quantity: 14, unitPriceCents: 4800 },
        { description: "Overnight freight", quantity: 2, unitPriceCents: 28500 },
      ],
    },
    {
      vendor: "Globex Office Supplies",
      invoiceNumber: "GLX-771234",
      invoiceDate: daysFromNow(-22),
      dueDate: daysFromNow(8),
      status: "approved",
      lines: [
        { description: "Standing desks (model E2)", quantity: 4, unitPriceCents: 49900 },
        { description: "Monitor arms", quantity: 8, unitPriceCents: 12500 },
        { description: "Notebooks (case of 24)", quantity: 3, unitPriceCents: 6800 },
      ],
    },
    {
      vendor: "Initech Software",
      invoiceNumber: "INV-2026-0412",
      invoiceDate: daysFromNow(-18),
      dueDate: daysFromNow(-3), // overdue
      status: "needs_review",
      notes: "Annual license renewal",
      lines: [
        { description: "Initech Pro - annual seat license × 25", quantity: 25, unitPriceCents: 18000 },
      ],
    },
    {
      vendor: "Hooli Cloud",
      invoiceNumber: "HC-INV-90211",
      invoiceDate: daysFromNow(-45),
      dueDate: daysFromNow(-15), // overdue
      status: "needs_review",
      lines: [
        { description: "Managed Kubernetes cluster", quantity: 1, unitPriceCents: 145000 },
        { description: "DNS + load balancer", quantity: 1, unitPriceCents: 28000 },
      ],
    },
    {
      vendor: "Pied Piper Hosting",
      invoiceNumber: "PP-2026-0501",
      invoiceDate: daysFromNow(-7),
      dueDate: daysFromNow(7),
      status: "scheduled",
      scheduled: { method: "card", inDays: 5 },
      lines: [
        { description: "CDN bandwidth", quantity: 1, unitPriceCents: 89000 },
      ],
    },
    {
      vendor: "Vandelay Industries",
      invoiceNumber: "V-2026-218",
      invoiceDate: daysFromNow(-95),
      dueDate: daysFromNow(-65), // very overdue
      status: "needs_review",
      notes: "Disputed — vendor follow-up needed",
      lines: [
        { description: "Q1 import duties", quantity: 1, unitPriceCents: 312000 },
      ],
    },
    {
      vendor: "Acme Cloud Services",
      invoiceNumber: "ACM-2026-0301",
      invoiceDate: daysFromNow(-50),
      dueDate: daysFromNow(-20),
      status: "paid",
      paid: { method: "ach", daysAgo: 14 },
      lines: [
        { description: "Compute hours - production", quantity: 720, unitPriceCents: 145 },
        { description: "Object storage (TB-month)", quantity: 4, unitPriceCents: 2300 },
      ],
    },
    {
      vendor: "Globex Office Supplies",
      invoiceNumber: "GLX-770198",
      invoiceDate: daysFromNow(-60),
      dueDate: daysFromNow(-30),
      status: "paid",
      paid: { method: "check", daysAgo: 25 },
      lines: [
        { description: "Coffee service - quarterly", quantity: 1, unitPriceCents: 145000 },
      ],
    },
  ];

  for (const b of seedBills) {
    const subtotal = b.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
    const tax = Math.round(subtotal * 0.0875);
    const total = subtotal + tax;

    const [bill] = await db
      .insert(schema.bills)
      .values({
        orgId: org.id,
        vendorId: v[b.vendor].id,
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.invoiceDate,
        dueDate: b.dueDate,
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: total,
        status: b.status,
        source: "upload",
        notes: b.notes,
      })
      .returning();

    await db.insert(schema.billLineItems).values(
      b.lines.map((l, i) => ({
        billId: bill.id,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        amountCents: l.quantity * l.unitPriceCents,
        sortOrder: i,
      }))
    );

    // Always at least the "created" event.
    await db.insert(schema.billEvents).values({
      billId: bill.id,
      event: "created",
      payload: { source: "seed" },
    });

    if (b.status !== "draft") {
      await db.insert(schema.billEvents).values({
        billId: bill.id,
        event: "extracted",
        payload: { confidence: 0.92 + Math.random() * 0.07 },
      });
    }

    if (
      b.status === "approved" ||
      b.status === "scheduled" ||
      b.status === "paid"
    ) {
      await db.insert(schema.billEvents).values({
        billId: bill.id,
        event: "approved",
        payload: { approver: "demo@trashlab.com" },
      });
    }

    if (b.scheduled) {
      const [pay] = await db
        .insert(schema.payments)
        .values({
          billId: bill.id,
          scheduledFor: daysFromNow(b.scheduled.inDays),
          method: b.scheduled.method,
          amountCents: total,
          status: "scheduled",
        })
        .returning();
      await db.insert(schema.billEvents).values({
        billId: bill.id,
        event: "scheduled",
        payload: { paymentId: pay.id, method: b.scheduled.method },
      });
    }

    if (b.paid) {
      const paidAt = new Date();
      paidAt.setDate(paidAt.getDate() - b.paid.daysAgo);
      const [pay] = await db
        .insert(schema.payments)
        .values({
          billId: bill.id,
          scheduledFor: daysFromNow(-b.paid.daysAgo),
          paidAt,
          method: b.paid.method,
          amountCents: total,
          status: "paid",
        })
        .returning();
      await db.insert(schema.billEvents).values({
        billId: bill.id,
        event: "scheduled",
        payload: { paymentId: pay.id, method: b.paid.method },
      });
      await db.insert(schema.billEvents).values({
        billId: bill.id,
        event: "paid",
        payload: { paymentId: pay.id, paidAt: paidAt.toISOString() },
      });
    }
  }

  console.log("✓ Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
