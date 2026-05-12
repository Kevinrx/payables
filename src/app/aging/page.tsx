import Link from "next/link";
import { sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, Download } from "lucide-react";
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
  max_days_overdue: string;
};

type Tone = "neutral" | "warning" | "danger";

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
      COALESCE(SUM(b.total_cents), 0) AS total_cents,
      COALESCE(MAX(CASE WHEN b.due_date < CURRENT_DATE THEN (CURRENT_DATE - b.due_date)::int ELSE 0 END), 0) AS max_days_overdue
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
  const overdueVendorCount = rows.filter(
    (r) =>
      Number(r.bucket_1_30) + Number(r.bucket_31_60) + Number(r.bucket_61_90) + Number(r.bucket_90_plus) > 0
  ).length;
  const oldestDays = rows.reduce((m, r) => Math.max(m, Number(r.max_days_overdue)), 0);

  const csvHref = buildCsvHref(rows);

  const cards: { label: string; cents: number; tone: Tone }[] = [
    { label: "Current",     cents: totals.current, tone: "neutral" },
    { label: "1–30 days",   cents: totals.b1_30,   tone: "warning" },
    { label: "31–60 days",  cents: totals.b31_60,  tone: "warning" },
    { label: "61–90 days",  cents: totals.b61_90,  tone: "danger"  },
    { label: "90+ days",    cents: totals.b90,     tone: "danger"  },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight sm:text-[32px]">AP Aging</h1>
        <p className="mt-1 text-[13px] text-ink-faint sm:text-[13.5px]">
          Outstanding bills bucketed by how overdue they are. Excludes paid and voided.
        </p>
      </div>

      {/* Bucket cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <BucketCard key={c.label} {...c} grand={totals.grand} />
        ))}
      </div>

      {/* Overdue callout */}
      {totalOverdue > 0 && (
        <div
          className="mt-5 flex flex-col gap-3 rounded-xl px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center"
          style={{ background: "var(--danger-soft)" }}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span
              className="grid h-9 w-9 place-items-center rounded-md shrink-0"
              style={{ background: "var(--danger-strong)", color: "var(--paper)" }}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="text-[16px] font-mono tabular font-semibold sm:text-[18px]"
                style={{ color: "var(--danger-strong)" }}
              >
                {formatMoney(totalOverdue)} <span className="font-sans">overdue</span>
              </div>
              <div className="text-[12px] sm:text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                across {overdueVendorCount} {overdueVendorCount === 1 ? "vendor" : "vendors"}
                {oldestDays > 0 && ` · oldest is ${oldestDays} ${oldestDays === 1 ? "day" : "days"} past due`}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:w-auto">
            <a href={csvHref} download="aging.csv" className="btn btn-secondary justify-center">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
            <Link href="/bills?status=overdue" className="btn btn-primary justify-center">
              Review overdue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Per-vendor table */}
      <div className="surface mt-6 overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[13.5px] font-medium">No outstanding bills</p>
            <p className="mt-1 text-[12px] text-ink-faint">
              You&apos;re all caught up. Bills will appear here as they&apos;re created.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="text-left"
                  style={{ borderBottom: "1px solid var(--rule)", background: "var(--paper-sunken)" }}
                >
                  <th className="px-4 py-2.5 micro">Vendor</th>
                  <th className="px-4 py-2.5 text-right micro">Current</th>
                  <th className="px-4 py-2.5 text-right micro">1–30</th>
                  <th className="px-4 py-2.5 text-right micro">31–60</th>
                  <th className="px-4 py-2.5 text-right micro">61–90</th>
                  <th className="px-4 py-2.5 text-right micro">90+</th>
                  <th className="px-4 py-2.5 text-right micro">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.vendor_id}
                    className="transition-colors hover:bg-paper-sunken"
                    style={{ borderBottom: "1px solid var(--rule-faint)" }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/vendors/${r.vendor_id}`}
                        className="text-[13.5px] font-medium hover:underline"
                      >
                        {r.vendor_name}
                      </Link>
                      <div className="mt-0.5 text-[11.5px] text-ink-faint">
                        {r.bill_count} {Number(r.bill_count) === 1 ? "bill" : "bills"}
                      </div>
                    </td>
                    <BucketCell cents={Number(r.current_cents)} />
                    <BucketCell cents={Number(r.bucket_1_30)} tone="warning" />
                    <BucketCell cents={Number(r.bucket_31_60)} tone="warning" />
                    <BucketCell cents={Number(r.bucket_61_90)} tone="danger" />
                    <BucketCell cents={Number(r.bucket_90_plus)} tone="danger" />
                    <td className="px-4 py-3 text-right text-[13.5px] font-semibold font-mono tabular">
                      {formatMoney(Number(r.total_cents))}
                    </td>
                  </tr>
                ))}
                <tr
                  className="font-medium"
                  style={{ borderTop: "2px solid var(--rule-strong)", background: "var(--paper-sunken)" }}
                >
                  <td className="px-4 py-3 text-[13px]">Total</td>
                  <BucketCell cents={totals.current} />
                  <BucketCell cents={totals.b1_30} />
                  <BucketCell cents={totals.b31_60} />
                  <BucketCell cents={totals.b61_90} />
                  <BucketCell cents={totals.b90} />
                  <td className="px-4 py-3 text-right text-[13.5px] font-semibold font-mono tabular">
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

function toneColor(tone: Tone, isZero: boolean) {
  if (isZero) return "var(--ink-fainter)";
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "var(--warn-strong)";
  return "var(--ink)";
}

function BucketCard({
  label,
  cents,
  tone,
  grand,
}: {
  label: string;
  cents: number;
  tone: Tone;
  grand: number;
}) {
  const isZero = cents === 0;
  const pct = grand > 0 ? (cents / grand) * 100 : 0;
  const color = toneColor(tone, isZero);
  return (
    <div className="surface px-4 py-3.5">
      <div className="micro">{label}</div>
      <div
        className="mt-2 text-[26px] leading-none font-semibold tabular tracking-tight font-mono"
        style={{ color }}
      >
        {formatMoney(cents)}
      </div>
      <div
        className="mt-3 h-1 rounded-full overflow-hidden"
        style={{ background: "var(--rule-faint)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(pct, 100)}%`, background: isZero ? "transparent" : color }}
        />
      </div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[0.08em] tabular" style={{ color: "var(--ink-faint)" }}>
        {pct.toFixed(1)}% of total
      </div>
    </div>
  );
}

function BucketCell({
  cents,
  tone = "neutral",
}: {
  cents: number;
  tone?: Tone;
}) {
  const isZero = cents === 0;
  const color = toneColor(tone, isZero);
  return (
    <td
      className="px-4 py-3 text-right text-[13px] font-mono tabular"
      style={{
        color,
        fontWeight: tone === "danger" && !isZero ? 600 : undefined,
      }}
    >
      {isZero ? "—" : formatMoney(cents)}
    </td>
  );
}

function buildCsvHref(rows: Row[]): string {
  const header = [
    "vendor",
    "bill_count",
    "current",
    "1_30_days",
    "31_60_days",
    "61_90_days",
    "90_plus_days",
    "total",
  ];
  const lines = rows.map((r) => [
    csvEscape(r.vendor_name),
    r.bill_count,
    centsToDollars(r.current_cents),
    centsToDollars(r.bucket_1_30),
    centsToDollars(r.bucket_31_60),
    centsToDollars(r.bucket_61_90),
    centsToDollars(r.bucket_90_plus),
    centsToDollars(r.total_cents),
  ].join(","));
  const body = [header.join(","), ...lines].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(body)}`;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function centsToDollars(cents: string): string {
  return (Number(cents) / 100).toFixed(2);
}
