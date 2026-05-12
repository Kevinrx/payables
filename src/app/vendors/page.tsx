import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { VendorsList, type VendorRow } from "@/components/vendors-list";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const orgId = await getDemoOrgId();
  const rows = await db.execute<{
    id: string;
    name: string;
    email: string | null;
    default_payment_method: string | null;
    bill_count: string;
    outstanding_cents: string;
    paid_cents: string;
  }>(sql`
    SELECT v.id, v.name, v.email, v.default_payment_method,
      COUNT(b.id) AS bill_count,
      COALESCE(SUM(CASE WHEN b.status NOT IN ('paid','void') THEN b.total_cents ELSE 0 END), 0) AS outstanding_cents,
      COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.total_cents ELSE 0 END), 0) AS paid_cents
    FROM vendors v
    LEFT JOIN bills b ON b.vendor_id = v.id
    WHERE v.org_id = ${orgId}
    GROUP BY v.id
    ORDER BY
      COALESCE(SUM(CASE WHEN b.status NOT IN ('paid','void') THEN b.total_cents ELSE 0 END), 0) DESC,
      v.name ASC
  `);

  const vendors: VendorRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    defaultPaymentMethod: r.default_payment_method,
    billCount: Number(r.bill_count),
    outstandingCents: Number(r.outstanding_cents),
    paidCents: Number(r.paid_cents),
  }));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight">Vendors</h1>
        <p className="mt-1 text-[13.5px] text-ink-faint">Suppliers you&apos;ve paid or owe.</p>
      </div>

      <VendorsList rows={vendors} />
    </div>
  );
}
