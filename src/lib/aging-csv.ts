import { csvEscape, centsToDollars } from "./csv";

export type AgingCsvRow = {
  vendor_name: string;
  bill_count: string | number;
  current_cents: string | number;
  bucket_1_30: string | number;
  bucket_31_60: string | number;
  bucket_61_90: string | number;
  bucket_90_plus: string | number;
  total_cents: string | number;
};

export function buildAgingCsvHref(rows: AgingCsvRow[]): string {
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
  const lines = rows.map((r) =>
    [
      csvEscape(r.vendor_name),
      r.bill_count,
      centsToDollars(r.current_cents),
      centsToDollars(r.bucket_1_30),
      centsToDollars(r.bucket_31_60),
      centsToDollars(r.bucket_61_90),
      centsToDollars(r.bucket_90_plus),
      centsToDollars(r.total_cents),
    ].join(",")
  );
  const body = [header.join(","), ...lines].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(body)}`;
}
