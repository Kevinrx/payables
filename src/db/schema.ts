import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  date,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────

export const billStatus = pgEnum("bill_status", [
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "paid",
  "void",
]);

export const billSource = pgEnum("bill_source", ["upload", "manual"]);

export const paymentMethod = pgEnum("payment_method", ["ach", "check", "card"]);

export const paymentStatus = pgEnum("payment_status", [
  "scheduled",
  "paid",
  "failed",
  "canceled",
]);

export const billEvent = pgEnum("bill_event", [
  "created",
  "extracted",
  "edited",
  "approved",
  "scheduled",
  "paid",
  "voided",
]);

// ─── Tables ─────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    defaultPaymentMethod: paymentMethod("default_payment_method").default("ach"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("vendors_org_name_lower_idx").on(t.orgId, sql`lower(${t.name})`),
  ]
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),
    invoiceNumber: text("invoice_number"),
    invoiceDate: date("invoice_date"),
    dueDate: date("due_date"),
    subtotalCents: integer("subtotal_cents"),
    taxCents: integer("tax_cents"),
    totalCents: integer("total_cents"),
    currency: text("currency").notNull().default("USD"),
    status: billStatus("status").notNull().default("draft"),
    source: billSource("source").notNull().default("upload"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileMime: text("file_mime"),
    extractedJson: jsonb("extracted_json"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bills_org_status_idx").on(t.orgId, t.status),
    index("bills_due_date_idx").on(t.dueDate),
  ]
);

export const billLineItems = pgTable("bill_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity"),
  unitPriceCents: integer("unit_price_cents"),
  amountCents: integer("amount_cents").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id, { onDelete: "cascade" }),
  scheduledFor: date("scheduled_for").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  method: paymentMethod("method").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatus("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const billEvents = pgTable("bill_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id, { onDelete: "cascade" }),
  event: billEvent("event").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Inferred types ─────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type BillLineItem = typeof billLineItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type BillEventRow = typeof billEvents.$inferSelect;

export type BillStatus = (typeof billStatus.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
