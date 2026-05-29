import Link from "next/link";
import type { PaymentListRow } from "@/db/queries";
import { paymentBucket } from "@/lib/payments";
import { formatDate, formatMoney } from "@/lib/utils";
import { VendorAvatar } from "./vendor-avatar";
import { MethodPill } from "./method-pill";
import { PaymentStatusBadge } from "./payment-status-badge";
import { PaymentActions } from "./payment-actions";

// checkbox · vendor · invoice · scheduled · method · amount · status · actions
const GRID_TEMPLATE = "28px minmax(0, 1.6fr) 1fr 1.1fr 64px 1fr 116px 44px";

export function PaymentRow({
  row,
  today,
  selected,
  onSelectChange,
}: {
  row: PaymentListRow;
  today: string;
  selected: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
}) {
  const billHref = `/bills/${row.billId}?from=payments`;
  // Rail matches the Needs-review bucket: failed payments AND stale-scheduled
  // ones (date passed, should have released) — not just `failed`.
  const needsAttention = paymentBucket(row, today) === "needs_review";

  return (
    <div className="group relative border-b border-border bg-surface transition-colors last:border-b-0 hover:bg-surface-hover">
      {needsAttention && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "var(--danger)" }}
        />
      )}

      {/* Desktop */}
      <div
        className="hidden items-center gap-3 px-[18px] py-3 sm:grid"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        <Checkbox id={row.id} checked={selected} onChange={onSelectChange} />
        <Link href={billHref} className="contents">
          <div className="flex min-w-0 items-center gap-2.5">
            <VendorAvatar name={row.vendorName ?? "?"} size="sm" />
            <span
              className={
                "truncate text-[14px] font-medium tracking-tight " +
                (row.vendorName ? "text-ink" : "text-ink-faint")
              }
            >
              {row.vendorName ?? "No vendor"}
            </span>
          </div>
          <div className="font-mono text-xs text-ink-faint tabular">
            {row.invoiceNumber ?? "—"}
          </div>
          <div className="text-[13px] tabular">{formatDate(row.scheduledFor)}</div>
          <div>
            <MethodPill method={row.method} size="sm" />
          </div>
          <div className="text-right font-mono text-[14px] font-medium tabular tracking-tight">
            {formatMoney(row.amountCents, row.currency)}
          </div>
          <div>
            <PaymentStatusBadge status={row.status} />
          </div>
        </Link>
        <PaymentActions
          paymentId={row.id}
          status={row.status}
          scheduledFor={row.scheduledFor}
        />
      </div>

      {/* Mobile */}
      <div className="flex items-start gap-2.5 px-4 py-3 sm:hidden">
        <Checkbox id={row.id} checked={selected} onChange={onSelectChange} className="mt-1" />
        <Link href={billHref} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <VendorAvatar name={row.vendorName ?? "?"} size="sm" />
            <span
              className={
                "truncate text-[14px] font-medium tracking-tight " +
                (row.vendorName ? "text-ink" : "text-ink-faint")
              }
            >
              {row.vendorName ?? "No vendor"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] tabular font-mono text-ink-faint">
            {row.invoiceNumber && <span>{row.invoiceNumber}</span>}
            <span>·</span>
            <span>{formatDate(row.scheduledFor)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <PaymentStatusBadge status={row.status} />
            <MethodPill method={row.method} size="sm" />
          </div>
        </Link>
        <div className="flex flex-col items-end gap-1.5">
          <span className="font-mono text-[15px] font-medium tabular tracking-tight whitespace-nowrap">
            {formatMoney(row.amountCents, row.currency)}
          </span>
          <PaymentActions
            paymentId={row.id}
            status={row.status}
            scheduledFor={row.scheduledFor}
          />
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (id: string, checked: boolean) => void;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(id, e.target.checked)}
      aria-label="Select payment"
      className={"h-4 w-4 flex-none cursor-pointer accent-[var(--brand)] " + (className ?? "")}
      style={{ accentColor: "var(--brand)" }}
    />
  );
}

export { GRID_TEMPLATE as PAYMENT_ROW_GRID_TEMPLATE };
