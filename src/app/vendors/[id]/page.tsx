import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Mail } from "lucide-react";
import { getDemoOrgId, getVendorById, type VendorDetail } from "@/db/queries";
import { StatusBadge } from "@/components/status-badge";
import { daysUntilDue, formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getDemoOrgId();
  const data = await getVendorById(id, orgId);
  if (!data) notFound();

  const initials = getInitials(data.vendor.name);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <Link href="/vendors" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to vendors
      </Link>

      {/* Hero */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span
            className="grid h-14 w-14 flex-none place-items-center rounded-md text-[15px] font-semibold uppercase"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              background: "var(--paper-sunken)",
              color: "var(--ink-2)",
              border: "1px solid var(--rule)",
            }}
          >
            {initials}
          </span>
          <div className="min-w-0">
            <span className="micro">Vendor</span>
            <h1 className="mt-1 truncate text-[28px] font-semibold tracking-tight">
              {data.vendor.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-faint">
              {data.vendor.email && (
                <a
                  href={`mailto:${data.vendor.email}`}
                  className="inline-flex items-center gap-1 hover:text-ink"
                >
                  <Mail className="h-3 w-3" />
                  {data.vendor.email}
                </a>
              )}
              {data.vendor.defaultPaymentMethod && (
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    background: "var(--paper-sunken)",
                    color: "var(--ink-2)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  {data.vendor.defaultPaymentMethod}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Outstanding"
          cents={data.stats.outstandingCents}
          tone={data.stats.outstandingCents > 0 ? "ink" : "faint"}
          sub={
            data.stats.outstandingCents > 0
              ? `${countOutstandingBills(data)} ${countOutstandingBills(data) === 1 ? "bill" : "bills"} unpaid`
              : "All caught up"
          }
        />
        <StatTile
          label="Paid (lifetime)"
          cents={data.stats.paidCents}
          tone="success"
          sub={`${data.stats.byStatus["paid"] ?? 0} paid`}
        />
        <StatTile
          label="Total bills"
          countLabel={String(data.stats.billCount)}
          sub={statusBreakdown(data.stats.byStatus)}
        />
      </div>

      {/* Bills */}
      <div className="mt-7">
        <h2 className="text-[18px] font-semibold tracking-tight">Bills</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-faint">
          {data.bills.length === 0
            ? "No bills attached to this vendor yet."
            : `${data.bills.length} bill${data.bills.length === 1 ? "" : "s"} from ${data.vendor.name}.`}
        </p>
      </div>

      <div className="surface mt-3 overflow-hidden">
        {data.bills.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[13px] text-ink-faint">
              Upload an invoice or create a bill manually to attach it to this vendor.
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
                  <th className="px-4 py-2.5 micro">Invoice #</th>
                  <th className="px-4 py-2.5 micro">Due</th>
                  <th className="px-4 py-2.5 text-right micro">Amount</th>
                  <th className="px-4 py-2.5 micro">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.bills.map((b) => {
                  const days = daysUntilDue(b.dueDate);
                  const isOverdue =
                    days !== null && days < 0 && b.status !== "paid" && b.status !== "void";
                  const billUrl = `/bills/${b.id}?from=vendor:${data.vendor.id}`;
                  return (
                    <tr
                      key={b.id}
                      className="group transition-colors hover:bg-paper-sunken"
                      style={{ borderBottom: "1px solid var(--rule-faint)", position: "relative" }}
                    >
                      <td className="px-4 py-3 text-[12.5px] font-mono tabular text-ink-faint">
                        <Link
                          href={billUrl}
                          aria-label={`Open bill ${b.invoiceNumber ?? ""}`}
                          className="font-medium text-ink group-hover:underline before:absolute before:inset-0 before:content-['']"
                        >
                          {b.invoiceNumber ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] tabular">{formatDate(b.dueDate)}</div>
                        {days !== null && b.status !== "paid" && b.status !== "void" && (
                          <div
                            className="mt-0.5 text-[11px] tabular"
                            style={{
                              color: isOverdue ? "var(--danger)" : "var(--ink-faint)",
                            }}
                          >
                            {isOverdue
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                              ? "Due today"
                              : `${days}d to due`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[13.5px] font-mono tabular font-medium">
                        {b.totalCents !== null ? formatMoney(b.totalCents) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={isOverdue ? "overdue" : b.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          aria-hidden
                          className="inline-flex h-7 w-7 items-center justify-center text-ink-fainter transition-colors group-hover:text-ink"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  cents,
  countLabel,
  sub,
  tone = "ink",
}: {
  label: string;
  cents?: number;
  countLabel?: string;
  sub?: string;
  tone?: "ink" | "faint" | "success";
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "faint" ? "var(--ink-fainter)" : "var(--ink)";
  return (
    <div className="surface px-4 py-3.5">
      <div className="micro">{label}</div>
      <div
        className="mt-2 text-[24px] font-semibold tabular tracking-tight font-mono"
        style={{ color }}
      >
        {countLabel ?? formatMoney(cents ?? 0)}
      </div>
      {sub && (
        <div className="mt-1 text-[11.5px] text-ink-faint">{sub}</div>
      )}
    </div>
  );
}

function countOutstandingBills(data: VendorDetail) {
  return data.bills.filter((b) => b.status !== "paid" && b.status !== "void").length;
}

function statusBreakdown(byStatus: Record<string, number>): string {
  const order = ["draft", "needs_review", "approved", "scheduled", "paid", "void"];
  const parts = order
    .filter((s) => byStatus[s])
    .map((s) => `${byStatus[s]} ${s.replace("_", " ")}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
