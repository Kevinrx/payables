"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { extractInvoice } from "@/lib/extract";

const { bills, payments, billEvents, vendors, billLineItems } = schema;

// ─── Run extraction (Claude vision) ─────────────────────────────────

function dollarsToCents(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export async function runExtraction(billId: string): Promise<Result> {
  try {
    const orgId = await getDemoOrgId();
    const bill = await findBillForOrg(billId, orgId);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (!bill.fileUrl || !bill.fileMime) {
      return { ok: false, error: "Bill has no attached file" };
    }
    if (bill.extractedJson) {
      // Already extracted; nothing to do.
      return { ok: true };
    }

    // Fetch the file bytes. For local /uploads/ paths we read from disk
    // (avoids needing an absolute URL during dev); for blob URLs we fetch.
    let buffer: Buffer;
    if (bill.fileUrl.startsWith("/uploads/")) {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      buffer = await readFile(resolve(process.cwd(), "public", bill.fileUrl.slice(1)));
    } else {
      const res = await fetch(bill.fileUrl);
      if (!res.ok) {
        return { ok: false, error: `Failed to fetch file (${res.status})` };
      }
      buffer = Buffer.from(await res.arrayBuffer());
    }

    let extracted;
    try {
      extracted = await extractInvoice({ buffer, mime: bill.fileMime });
    } catch (e) {
      // Extraction failed — leave bill as draft, log the failure event,
      // surface a clear error so the UI can prompt manual entry.
      const msg = e instanceof Error ? e.message : "Extraction failed";
      await db.insert(billEvents).values({
        billId,
        event: "extracted",
        payload: { ok: false, error: msg },
      });
      return { ok: false, error: msg };
    }

    // Resolve vendor: dedup by case-insensitive name.
    let vendorId: string | null = null;
    if (extracted.vendor_name) {
      const [existing] = await db
        .select()
        .from(vendors)
        .where(
          and(
            eq(vendors.orgId, orgId),
            sql`lower(${vendors.name}) = lower(${extracted.vendor_name})`
          )
        )
        .limit(1);
      if (existing) {
        vendorId = existing.id;
      } else {
        const [created] = await db
          .insert(vendors)
          .values({ orgId, name: extracted.vendor_name })
          .returning();
        vendorId = created.id;
      }
    }

    const subtotalCents = dollarsToCents(extracted.subtotal);
    const taxCents = dollarsToCents(extracted.tax);
    const totalCents = dollarsToCents(extracted.total);

    await db.transaction(async (tx) => {
      await tx
        .update(bills)
        .set({
          vendorId,
          invoiceNumber: extracted.invoice_number,
          invoiceDate: extracted.invoice_date,
          dueDate: extracted.due_date,
          currency: extracted.currency || "USD",
          subtotalCents,
          taxCents,
          totalCents,
          notes: extracted.notes,
          status: "needs_review",
          extractedJson: extracted as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId));

      await tx.delete(billLineItems).where(eq(billLineItems.billId, billId));
      if (extracted.line_items.length > 0) {
        await tx.insert(billLineItems).values(
          extracted.line_items.map((li, i) => ({
            billId,
            description: li.description,
            quantity: li.quantity != null ? Math.round(li.quantity) : null,
            unitPriceCents: dollarsToCents(li.unit_price),
            amountCents: dollarsToCents(li.amount) ?? 0,
            sortOrder: i,
          }))
        );
      }

      await tx.insert(billEvents).values({
        billId,
        event: "extracted",
        payload: {
          ok: true,
          vendor: extracted.vendor_name,
          lineCount: extracted.line_items.length,
        },
      });
    });

    revalidatePath(`/bills/${billId}`);
    revalidatePath("/bills");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function findBillForOrg(billId: string, orgId: string) {
  const [b] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.orgId, orgId)))
    .limit(1);
  return b;
}

// ─── Approve ────────────────────────────────────────────────────────

export async function approveBill(billId: string): Promise<Result> {
  try {
    const orgId = await getDemoOrgId();
    const bill = await findBillForOrg(billId, orgId);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (bill.status !== "needs_review" && bill.status !== "draft") {
      return { ok: false, error: `Cannot approve a bill in status ${bill.status}` };
    }
    if (!bill.totalCents || bill.totalCents <= 0) {
      return { ok: false, error: "Bill must have a positive total before approval" };
    }
    if (!bill.dueDate) {
      return { ok: false, error: "Bill must have a due date before approval" };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(bills)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(bills.id, billId));
      await tx.insert(billEvents).values({
        billId,
        event: "approved",
        payload: { approver: "demo@trashlab.com" },
      });
    });

    revalidatePath(`/bills/${billId}`);
    revalidatePath("/bills");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ─── Schedule payment ───────────────────────────────────────────────

const scheduleSchema = z.object({
  scheduledFor: z.string().min(1),
  method: z.enum(["ach", "check", "card"]),
  amountCents: z.number().int().positive(),
});

export async function schedulePayment(
  billId: string,
  input: z.infer<typeof scheduleSchema>
): Promise<Result> {
  try {
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid input" };

    const orgId = await getDemoOrgId();
    const bill = await findBillForOrg(billId, orgId);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (bill.status !== "approved") {
      return { ok: false, error: `Cannot schedule payment for a bill in status ${bill.status}` };
    }

    const paymentId = await db.transaction(async (tx) => {
      const [pay] = await tx
        .insert(payments)
        .values({
          billId,
          scheduledFor: parsed.data.scheduledFor,
          method: parsed.data.method,
          amountCents: parsed.data.amountCents,
          status: "scheduled",
        })
        .returning();
      await tx
        .update(bills)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(eq(bills.id, billId));
      await tx.insert(billEvents).values({
        billId,
        event: "scheduled",
        payload: {
          paymentId: pay.id,
          method: parsed.data.method,
          scheduledFor: parsed.data.scheduledFor,
          amountCents: parsed.data.amountCents,
        },
      });
      return pay.id;
    });

    revalidatePath(`/bills/${billId}`);
    revalidatePath("/bills");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ─── Mark paid ──────────────────────────────────────────────────────

export async function markBillPaid(billId: string): Promise<Result> {
  try {
    const orgId = await getDemoOrgId();
    const bill = await findBillForOrg(billId, orgId);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (bill.status !== "scheduled") {
      return { ok: false, error: `Cannot mark a bill in status ${bill.status} as paid` };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: "paid", paidAt: new Date() })
        .where(and(eq(payments.billId, billId), eq(payments.status, "scheduled")));
      await tx
        .update(bills)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(bills.id, billId));
      await tx.insert(billEvents).values({
        billId,
        event: "paid",
        payload: { paidAt: new Date().toISOString() },
      });
    });

    revalidatePath(`/bills/${billId}`);
    revalidatePath("/bills");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ─── Update bill (review form) ──────────────────────────────────────

const updateBillSchema = z.object({
  vendorId: z.string().uuid().nullable(),
  vendorName: z.string().min(1).nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  subtotalCents: z.number().int().nullable(),
  taxCents: z.number().int().nullable(),
  totalCents: z.number().int().nullable(),
  notes: z.string().nullable(),
  lineItems: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().int().nullable(),
      unitPriceCents: z.number().int().nullable(),
      amountCents: z.number().int(),
    })
  ),
});

export async function updateBill(
  billId: string,
  input: z.infer<typeof updateBillSchema>
): Promise<Result> {
  try {
    const parsed = updateBillSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const data = parsed.data;
    const orgId = await getDemoOrgId();
    const bill = await findBillForOrg(billId, orgId);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (bill.status !== "draft" && bill.status !== "needs_review") {
      return { ok: false, error: `Cannot edit a bill in status ${bill.status}` };
    }

    let resolvedVendorId = data.vendorId;
    if (!resolvedVendorId && data.vendorName) {
      // Resolve vendor by name (case-insensitive) or create one.
      const [existing] = await db
        .select()
        .from(vendors)
        .where(
          and(eq(vendors.orgId, orgId), sql`lower(${vendors.name}) = lower(${data.vendorName})`)
        )
        .limit(1);
      if (existing) {
        resolvedVendorId = existing.id;
      } else {
        const [created] = await db
          .insert(vendors)
          .values({ orgId, name: data.vendorName })
          .returning();
        resolvedVendorId = created.id;
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(bills)
        .set({
          vendorId: resolvedVendorId,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          subtotalCents: data.subtotalCents,
          taxCents: data.taxCents,
          totalCents: data.totalCents,
          notes: data.notes,
          status: "needs_review",
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId));

      await tx.delete(billLineItems).where(eq(billLineItems.billId, billId));
      if (data.lineItems.length > 0) {
        await tx.insert(billLineItems).values(
          data.lineItems.map((li, i) => ({
            billId,
            description: li.description,
            quantity: li.quantity,
            unitPriceCents: li.unitPriceCents,
            amountCents: li.amountCents,
            sortOrder: i,
          }))
        );
      }
      await tx.insert(billEvents).values({
        billId,
        event: "edited",
        payload: { fields: Object.keys(data) },
      });
    });

    revalidatePath(`/bills/${billId}`);
    revalidatePath("/bills");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
