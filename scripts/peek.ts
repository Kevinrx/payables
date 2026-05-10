import "./load-env";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("usage: tsx scripts/peek.ts <billId>");
  const [b] = await db.select().from(schema.bills).where(eq(schema.bills.id, id));
  console.log(JSON.stringify({ status: b?.status, vendorId: b?.vendorId, totalCents: b?.totalCents, dueDate: b?.dueDate, hasExtracted: !!b?.extractedJson }, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
