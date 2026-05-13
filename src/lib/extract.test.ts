import { describe, expect, it } from "vitest";
import { ExtractedInvoiceSchema } from "./extract";

// The model is only forced to return vendor_name / currency / total /
// line_items via the tool's required[]. Everything else may be omitted.
// These tests pin down that omission is treated as null, not a hard error.

describe("ExtractedInvoiceSchema leniency", () => {
  it("treats missing optional keys as null instead of failing", () => {
    const r = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      currency: "USD",
      total: 100,
      line_items: [],
      // invoice_number, invoice_date, due_date, subtotal, tax, notes all omitted
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.invoice_number).toBeNull();
      expect(r.data.invoice_date).toBeNull();
      expect(r.data.due_date).toBeNull();
      expect(r.data.subtotal).toBeNull();
      expect(r.data.tax).toBeNull();
      expect(r.data.notes).toBeNull();
    }
  });

  it("treats explicit null on optional fields as null", () => {
    const r = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      invoice_number: null,
      tax: null,
      currency: "USD",
      total: 100,
      line_items: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.invoice_number).toBeNull();
      expect(r.data.tax).toBeNull();
    }
  });

  it("recovers from a wrong-type optional field instead of throwing", () => {
    // Suppose the model accidentally returns an empty array for `tax`.
    const r = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      currency: "USD",
      total: 100,
      line_items: [],
      tax: [] as unknown,
      invoice_number: 12345 as unknown, // a number where we want a string
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tax).toBeNull();
      expect(r.data.invoice_number).toBeNull();
    }
  });

  it("normalizes empty-string optional fields to null", () => {
    const r = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      currency: "USD",
      total: 100,
      line_items: [],
      invoice_number: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.invoice_number).toBeNull();
  });

  it("falls back to USD currency when missing or non-string", () => {
    const r1 = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      total: 100,
      line_items: [],
    });
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.currency).toBe("USD");

    const r2 = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      currency: 123,
      total: 100,
      line_items: [],
    });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.currency).toBe("USD");
  });

  it("falls back to an empty line_items array when the array is malformed", () => {
    const r = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      currency: "USD",
      total: 100,
      line_items: "not an array" as unknown,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.line_items).toEqual([]);
  });

  it("keeps a well-formed line item intact", () => {
    const r = ExtractedInvoiceSchema.safeParse({
      vendor_name: "Acme",
      currency: "USD",
      total: 100,
      line_items: [
        { description: "Compute", quantity: 1, unit_price: 100, amount: 100 },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.line_items).toHaveLength(1);
      expect(r.data.line_items[0].description).toBe("Compute");
      expect(r.data.line_items[0].amount).toBe(100);
    }
  });
});
