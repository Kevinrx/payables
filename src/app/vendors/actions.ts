"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { findProfaneField } from "@/lib/content-filter";
import { notifyDiscord, vendorLink } from "@/lib/discord";

const { vendors } = schema;

const newVendorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  defaultPaymentMethod: z.enum(["ach", "check", "card"]).default("ach"),
});

export async function createVendor(
  input: z.infer<typeof newVendorSchema>
): Promise<Result<{ vendorId: string }>> {
  const parsed = newVendorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, defaultPaymentMethod } = parsed.data;

  const profaneField = findProfaneField({ name, email: email || null });
  if (profaneField) {
    return {
      ok: false,
      error: `The ${profaneField} isn't appropriate for this public demo — please change it.`,
    };
  }

  try {
    const orgId = await getDemoOrgId();

    const [existing] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.orgId, orgId), sql`lower(${vendors.name}) = lower(${name})`))
      .limit(1);
    if (existing) {
      return { ok: false, error: "A vendor with that name already exists" };
    }

    const [created] = await db
      .insert(vendors)
      .values({
        orgId,
        name,
        email: email && email.length > 0 ? email : null,
        defaultPaymentMethod,
      })
      .returning({ id: vendors.id });

    after(() => notifyDiscord(`🏢 New vendor created: **${name}**${vendorLink(created.id)}`));

    revalidatePath("/vendors");
    return { ok: true, data: { vendorId: created.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
