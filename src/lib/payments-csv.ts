// CSV export for the Payments screen. Mirrors src/lib/aging-csv.ts:
// build a data: URI from the currently-filtered rows so the export
// matches exactly what the user is looking at.

export type PaymentCsvRow = {
  vendorName: string | null;
  invoiceNumber: string | null;
  status: string;
  method: string;
  amountCents: number;
  scheduledFor: string | null;
  paidAt: Date | string | null;
  billDueDate: string | null;
};

export function buildPaymentsCsvHref(rows: PaymentCsvRow[]): string {
  const header = [
    "vendor",
    "invoice_number",
    "status",
    "method",
    "amount",
    "scheduled_for",
    "paid_at",
    "bill_due_date",
  ];
  const lines = rows.map((r) =>
    [
      csvEscape(r.vendorName ?? ""),
      csvEscape(r.invoiceNumber ?? ""),
      r.status,
      r.method,
      centsToDollars(r.amountCents),
      r.scheduledFor ?? "",
      toIsoDate(r.paidAt),
      r.billDueDate ?? "",
    ].join(",")
  );
  const body = [header.join(","), ...lines].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(body)}`;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function centsToDollars(cents: number): string {
  return (Number(cents) / 100).toFixed(2);
}

function toIsoDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
