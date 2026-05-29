"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { canManageTemplates } from "@/lib/permissions";
import { isSplitsValid, lineItemSplitSchema, type LineItemSplit } from "@/lib/categories";
import { groupCsvRowsToTemplates } from "@/lib/allocation-template-csv";

const { allocationTemplates } = schema;

/** Ramp caps saved templates per org. */
const MAX_TEMPLATES = 200;

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const NO_PERMISSION =
  "You don't have permission to manage allocation templates";

// Reuses the shared per-split schema (category + dimensions validated against
// the chart-of-accounts lists) so template and bill-editor validation can't drift.
const splitSchema = z
  .array(lineItemSplitSchema)
  .min(1)
  .max(150, "A template can have at most 150 lines")
  .refine(
    (s) => s.reduce((acc, x) => acc + x.percentageBps, 0) === 10000,
    "Splits must sum to 100%"
  );

const newTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  splits: splitSchema,
});

// ─── Create ─────────────────────────────────────────────────────────

export async function createAllocationTemplate(
  input: z.infer<typeof newTemplateSchema>
): Promise<Result<{ templateId: string }>> {
  const parsed = newTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, splits } = parsed.data;
  // Defense in depth beyond the zod refine (category present, ≤150, sums to 100%).
  if (!isSplitsValid(splits as LineItemSplit[])) {
    return { ok: false, error: "Splits must be valid and sum to 100%" };
  }

  try {
    const orgId = await getDemoOrgId();
    if (!canManageTemplates(orgId)) return { ok: false, error: NO_PERMISSION };

    // A plain count-then-insert is racy under READ COMMITTED (two creates can
    // both read count=199 and both insert -> 201). Take a per-org transaction
    // advisory lock first so concurrent create/import for the same org serialize
    // — making the count-based 200 cap actually safe (the unique index remains
    // the backstop for name dedup). Lock auto-releases at transaction end.
    const result = await db.transaction(
      async (tx): Promise<Result<{ templateId: string }>> => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`);
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(allocationTemplates)
          .where(eq(allocationTemplates.orgId, orgId));
        if (count >= MAX_TEMPLATES) {
          return { ok: false, error: `Template limit reached (${MAX_TEMPLATES} max)` };
        }

        const [existing] = await tx
          .select({ id: allocationTemplates.id })
          .from(allocationTemplates)
          .where(
            and(
              eq(allocationTemplates.orgId, orgId),
              sql`lower(${allocationTemplates.name}) = lower(${name})`
            )
          )
          .limit(1);
        if (existing) {
          return { ok: false, error: "A template with that name already exists" };
        }

        const [created] = await tx
          .insert(allocationTemplates)
          .values({ orgId, name, splits: splits as LineItemSplit[] })
          .returning({ id: allocationTemplates.id });

        return { ok: true, data: { templateId: created.id } };
      }
    );

    if (result.ok) revalidatePath("/settings/allocation-templates");
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ─── Delete ─────────────────────────────────────────────────────────

export async function deleteAllocationTemplate(id: string): Promise<Result> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid template id" };

  try {
    const orgId = await getDemoOrgId();
    if (!canManageTemplates(orgId)) return { ok: false, error: NO_PERMISSION };

    await db
      .delete(allocationTemplates)
      .where(
        and(
          eq(allocationTemplates.id, parsed.data),
          eq(allocationTemplates.orgId, orgId)
        )
      );

    revalidatePath("/settings/allocation-templates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ─── Bulk import via CSV ────────────────────────────────────────────

const csvRowSchema = z.object({
  template_name: z.string(),
  category: z.string(),
  department: z.string().nullable().optional(),
  gl_account: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  percentage: z.union([z.string(), z.number()]),
});

const importSchema = z.object({
  rows: z.array(csvRowSchema).min(1).max(5000),
});

export async function importAllocationTemplatesFromCsv(
  input: z.infer<typeof importSchema>
): Promise<Result<{ created: number; skipped: number; errors: string[] }>> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const orgId = await getDemoOrgId();
    if (!canManageTemplates(orgId)) return { ok: false, error: NO_PERMISSION };

    const { templates, errors } = groupCsvRowsToTemplates(parsed.data.rows);
    const skippedReasons = [...errors];

    let created = 0;
    let skipped = 0;

    await db.transaction(async (tx) => {
      // Serialize concurrent imports/creates for this org so the `room` budget
      // (the 200 cap) holds under READ COMMITTED. Released at transaction end.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`);

      const existing = await tx
        .select({ name: allocationTemplates.name })
        .from(allocationTemplates)
        .where(eq(allocationTemplates.orgId, orgId));

      const seen = new Set(existing.map((r) => r.name.toLowerCase()));
      let room = MAX_TEMPLATES - existing.length;

      const accepted: { orgId: string; name: string; splits: LineItemSplit[] }[] = [];
      for (const t of templates) {
        const key = t.name.toLowerCase();
        if (seen.has(key)) {
          skipped++;
          skippedReasons.push(`"${t.name}": already exists, skipped`);
          continue;
        }
        if (room <= 0) {
          skipped++;
          skippedReasons.push(`"${t.name}": template limit (${MAX_TEMPLATES}) reached`);
          continue;
        }
        accepted.push({ orgId, name: t.name, splits: t.splits });
        seen.add(key);
        room--;
        created++;
      }

      // One multi-row insert instead of N round-trips.
      if (accepted.length > 0) {
        await tx.insert(allocationTemplates).values(accepted);
      }
    });

    // Templates rejected during grouping (bad sums / categories / size) also count as skipped.
    skipped += errors.length;

    revalidatePath("/settings/allocation-templates");
    return { ok: true, data: { created, skipped, errors: skippedReasons } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
