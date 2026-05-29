import { describe, it, expect } from "vitest";
import { buildPaymentsCsvHref, type PaymentCsvRow } from "./payments-csv";

function decode(href: string): string {
  return decodeURIComponent(href.replace(/^data:text\/csv;charset=utf-8,/, ""));
}

const base: PaymentCsvRow = {
  vendorName: "Acme Cloud Services",
  invoiceNumber: "ACM-2026-0418",
  status: "scheduled",
  method: "ach",
  amountCents: 123456,
  scheduledFor: "2026-06-01",
  paidAt: null,
  billDueDate: "2026-06-15",
};

describe("buildPaymentsCsvHref", () => {
  it("emits a header row", () => {
    const csv = decode(buildPaymentsCsvHref([]));
    expect(csv.split("\n")[0]).toBe(
      "vendor,invoice_number,status,method,amount,scheduled_for,paid_at,bill_due_date"
    );
  });

  it("formats cents as dollars with two decimals", () => {
    const csv = decode(buildPaymentsCsvHref([base]));
    expect(csv.split("\n")[1]).toContain("1234.56");
  });

  it("escapes commas and quotes in vendor names", () => {
    const csv = decode(
      buildPaymentsCsvHref([{ ...base, vendorName: 'Globex, "the" Co' }])
    );
    expect(csv).toContain('"Globex, ""the"" Co"');
  });

  it("renders paidAt as a YYYY-MM-DD date and null as empty", () => {
    const paid = decode(
      buildPaymentsCsvHref([{ ...base, paidAt: new Date("2026-05-20T12:34:56Z") }])
    );
    expect(paid.split("\n")[1]).toContain("2026-05-20");

    const unpaid = decode(buildPaymentsCsvHref([base]));
    // scheduled_for present, paid_at empty between two commas
    expect(unpaid.split("\n")[1]).toContain("2026-06-01,,2026-06-15");
  });

  it("handles null vendor / invoice without throwing", () => {
    const csv = decode(
      buildPaymentsCsvHref([{ ...base, vendorName: null, invoiceNumber: null }])
    );
    expect(csv.split("\n")[1].startsWith(",,scheduled,ach")).toBe(true);
  });
});
