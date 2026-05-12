import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
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
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <div>
        <span className="micro">A/P · Vendors</span>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Vendors</h1>
        <p className="mt-1 text-[13px] text-ink-faint">
          Suppliers you&apos;ve paid or owe.
        </p>
      </div>

      <div className="surface mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className="text-left"
                style={{ borderBottom: "1px solid var(--rule)", background: "var(--paper-sunken)" }}
              >
                <th className="px-4 py-2.5 micro">Vendor</th>
                <th className="px-4 py-2.5 micro">Bills</th>
                <th className="px-4 py-2.5 text-right micro">Outstanding</th>
                <th className="px-4 py-2.5 text-right micro">Paid (lifetime)</th>
                <th className="px-4 py-2.5 micro">Default method</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-ink-faint">
                    No vendors yet.
                  </td>
                </tr>
              ) : (
                rows.map((v) => {
                  const outstanding = Number(v.outstanding_cents);
                  return (
                    <tr
                      key={v.id}
                      className="transition-colors hover:bg-paper-sunken"
                      style={{ borderBottom: "1px solid var(--rule-faint)" }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/bills?vendor=${encodeURIComponent(v.name)}`}
                          className="text-[13.5px] font-medium hover:underline"
                        >
                          {v.name}
                        </Link>
                        {v.email && (
                          <div className="mt-0.5 text-[11.5px] text-ink-faint">{v.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-mono tabular text-ink-2">
                        {v.bill_count}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-[13.5px] font-mono tabular font-semibold"
                        style={{ color: outstanding > 0 ? "var(--ink)" : "var(--ink-fainter)" }}
                      >
                        {outstanding > 0 ? formatMoney(outstanding) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-mono tabular text-ink-faint">
                        {formatMoney(Number(v.paid_cents))}
                      </td>
                      <td className="px-4 py-3">
                        {v.default_payment_method ? (
                          <span className="micro" style={{ color: "var(--ink-2)" }}>
                            {v.default_payment_method}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-ink-fainter">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
