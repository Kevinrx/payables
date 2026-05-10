import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { formatMoney } from "@/lib/utils";

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
    ORDER BY v.name
  `);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suppliers you've paid or owe.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Bills</th>
              <th className="px-4 py-2.5 text-right">Outstanding</th>
              <th className="px-4 py-2.5 text-right">Paid (lifetime)</th>
              <th className="px-4 py-2.5">Default method</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No vendors yet.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{v.name}</div>
                    {v.email && (
                      <div className="text-xs text-muted-foreground">{v.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm tabular">{v.bill_count}</td>
                  <td className="px-4 py-3 text-right text-sm tabular font-medium">
                    {formatMoney(Number(v.outstanding_cents))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular text-muted-foreground">
                    {formatMoney(Number(v.paid_cents))}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                    {v.default_payment_method ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
