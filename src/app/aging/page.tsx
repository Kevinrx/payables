import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  vendor_id: string;
  vendor_name: string;
  current_cents: string;
  bucket_1_30: string;
  bucket_31_60: string;
  bucket_61_90: string;
  bucket_90_plus: string;
  bill_count: string;
  total_cents: string;
};

export default async function AgingPage() {
  const orgId = await getDemoOrgId();

  const rows = await db.execute<Row>(sql`
    SELECT
      v.id AS vendor_id,
      v.name AS vendor_name,
      COALESCE(SUM(CASE WHEN b.due_date >= CURRENT_DATE THEN b.total_cents ELSE 0 END), 0) AS current_cents,
      COALESCE(SUM(CASE
        WHEN b.due_date < CURRENT_DATE
         AND b.due_date >= CURRENT_DATE - INTERVAL '30 days'
        THEN b.total_cents ELSE 0 END), 0) AS bucket_1_30,
      COALESCE(SUM(CASE
        WHEN b.due_date < CURRENT_DATE - INTERVAL '30 days'
         AND b.due_date >= CURRENT_DATE - INTERVAL '60 days'
        THEN b.total_cents ELSE 0 END), 0) AS bucket_31_60,
      COALESCE(SUM(CASE
        WHEN b.due_date < CURRENT_DATE - INTERVAL '60 days'
         AND b.due_date >= CURRENT_DATE - INTERVAL '90 days'
        THEN b.total_cents ELSE 0 END), 0) AS bucket_61_90,
      COALESCE(SUM(CASE
        WHEN b.due_date < CURRENT_DATE - INTERVAL '90 days'
        THEN b.total_cents ELSE 0 END), 0) AS bucket_90_plus,
      COUNT(b.id) AS bill_count,
      COALESCE(SUM(b.total_cents), 0) AS total_cents
    FROM bills b
    JOIN vendors v ON v.id = b.vendor_id
    WHERE b.org_id = ${orgId}
      AND b.status NOT IN ('paid', 'void')
    GROUP BY v.id, v.name
    HAVING COALESCE(SUM(b.total_cents), 0) > 0
    ORDER BY
      COALESCE(SUM(CASE WHEN b.due_date < CURRENT_DATE THEN b.total_cents ELSE 0 END), 0) DESC,
      v.name ASC
  `);

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + Number(r.current_cents),
      b1_30: acc.b1_30 + Number(r.bucket_1_30),
      b31_60: acc.b31_60 + Number(r.bucket_31_60),
      b61_90: acc.b61_90 + Number(r.bucket_61_90),
      b90: acc.b90 + Number(r.bucket_90_plus),
      grand: acc.grand + Number(r.total_cents),
      count: acc.count + Number(r.bill_count),
    }),
    { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90: 0, grand: 0, count: 0 }
  );

  const totalOverdue = totals.b1_30 + totals.b31_60 + totals.b61_90 + totals.b90;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AP Aging</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outstanding bills bucketed by how overdue they are. Excludes paid and voided bills.
        </p>
      </div>

      {/* Top-line summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total outstanding" cents={totals.grand} count={totals.count} emphasize />
        <SummaryCard label="Current" cents={totals.current} tone="neutral" />
        <SummaryCard label="1–30 days" cents={totals.b1_30} tone="warning" />
        <SummaryCard label="31–60 days" cents={totals.b31_60} tone="warning" />
        <SummaryCard label="61–90 days" cents={totals.b61_90} tone="danger" />
        <SummaryCard label="90+ days" cents={totals.b90} tone="danger" />
      </div>

      {totalOverdue > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-bg/60 px-4 py-2.5 text-sm text-danger">
          <span className="font-medium">{formatMoney(totalOverdue)} overdue</span>
          <span className="text-muted-foreground">
            across {totals.count} {totals.count === 1 ? "bill" : "bills"} from {rows.length} {rows.length === 1 ? "vendor" : "vendors"}
          </span>
        </div>
      )}

      {/* Per-vendor table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium">No outstanding bills</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You're all caught up. Bills will appear here as they're created.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5 text-right">Current</th>
                  <th className="px-4 py-2.5 text-right">1–30 days</th>
                  <th className="px-4 py-2.5 text-right">31–60 days</th>
                  <th className="px-4 py-2.5 text-right">61–90 days</th>
                  <th className="px-4 py-2.5 text-right">90+ days</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vendor_id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/bills?vendor=${encodeURIComponent(r.vendor_name)}`} className="font-medium">
                        {r.vendor_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.bill_count} {Number(r.bill_count) === 1 ? "bill" : "bills"}
                      </div>
                    </td>
                    <BucketCell cents={Number(r.current_cents)} />
                    <BucketCell cents={Number(r.bucket_1_30)} tone="warning" />
                    <BucketCell cents={Number(r.bucket_31_60)} tone="warning" />
                    <BucketCell cents={Number(r.bucket_61_90)} tone="danger" />
                    <BucketCell cents={Number(r.bucket_90_plus)} tone="danger" />
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular">
                      {formatMoney(Number(r.total_cents))}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-border bg-muted/30 font-medium">
                  <td className="px-4 py-3 text-sm">Total</td>
                  <BucketCell cents={totals.current} />
                  <BucketCell cents={totals.b1_30} />
                  <BucketCell cents={totals.b31_60} />
                  <BucketCell cents={totals.b61_90} />
                  <BucketCell cents={totals.b90} />
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular">
                    {formatMoney(totals.grand)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  cents,
  count,
  tone = "neutral",
  emphasize,
}: {
  label: string;
  cents: number;
  count?: number;
  tone?: "neutral" | "warning" | "danger";
  emphasize?: boolean;
}) {
  const toneRing =
    tone === "danger"
      ? "border-danger/20"
      : tone === "warning"
      ? "border-warning/20"
      : "border-border";
  return (
    <div
      className={`rounded-xl border bg-card p-4 ${emphasize ? "border-foreground" : toneRing}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 text-xl font-semibold tabular tracking-tight ${
          emphasize
            ? "text-foreground"
            : tone === "danger"
            ? "text-danger"
            : tone === "warning"
            ? "text-warning"
            : "text-foreground"
        }`}
      >
        {formatMoney(cents)}
      </div>
      {count !== undefined && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          {count} {count === 1 ? "bill" : "bills"}
        </div>
      )}
    </div>
  );
}

function BucketCell({
  cents,
  tone,
}: {
  cents: number;
  tone?: "warning" | "danger";
}) {
  const isZero = cents === 0;
  return (
    <td
      className={`px-4 py-3 text-right text-sm tabular ${
        isZero
          ? "text-muted-foreground"
          : tone === "danger"
          ? "text-danger font-medium"
          : tone === "warning"
          ? "text-warning"
          : ""
      }`}
    >
      {isZero ? "—" : formatMoney(cents)}
    </td>
  );
}
