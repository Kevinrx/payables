/**
 * End-to-end smoke test of the extraction flow against the live DB.
 * Reads a sample, uploads via /api/bills/upload, then calls
 * runExtraction directly, then prints the resulting bill row.
 */
import "./load-env";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

async function main() {
  const samplePath = process.argv[2] ?? "samples/01-acme-cloud.pdf";
  const buffer = await readFile(resolve(process.cwd(), samplePath));

  console.log("Uploading via API...");
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), samplePath);

  const upRes = await fetch("http://localhost:3000/api/bills/upload", {
    method: "POST",
    body: fd,
  });
  const up = await upRes.json();
  if (!upRes.ok) throw new Error(JSON.stringify(up));
  console.log("  billId:", up.billId);

  console.log("Triggering extraction (importing action)...");
  const { runExtraction } = await import("../src/app/bills/actions");
  const r = await runExtraction(up.billId);
  if (!r.ok) throw new Error(`extract failed: ${r.error}`);

  const [bill] = await db
    .select()
    .from(schema.bills)
    .where(eq(schema.bills.id, up.billId));
  console.log("\n✓ Bill after extraction:");
  console.log({
    id: bill.id,
    status: bill.status,
    invoiceNumber: bill.invoiceNumber,
    invoiceDate: bill.invoiceDate,
    dueDate: bill.dueDate,
    subtotalCents: bill.subtotalCents,
    taxCents: bill.taxCents,
    totalCents: bill.totalCents,
    vendorId: bill.vendorId,
  });

  const lines = await db
    .select()
    .from(schema.billLineItems)
    .where(eq(schema.billLineItems.billId, up.billId));
  console.log(`\n✓ ${lines.length} line items persisted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
