import { describe, it, expect } from "vitest";
import {
  formatMoney,
  dollarsToCents,
  daysUntilDue,
  agingBucket,
  AGING_BUCKET_LABELS,
} from "./utils";

describe("formatMoney", () => {
  it("formats whole dollars", () => {
    expect(formatMoney(100_00)).toBe("$100.00");
  });

  it("formats fractional dollars", () => {
    expect(formatMoney(1_234_56)).toBe("$1,234.56");
  });

  it("handles zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("returns em-dash for null", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("respects currency", () => {
    expect(formatMoney(100_00, "EUR")).toMatch(/100\.00/);
  });
});

describe("dollarsToCents", () => {
  it("converts decimal dollars to integer cents", () => {
    expect(dollarsToCents(12.34)).toBe(1234);
  });

  it("converts string input", () => {
    expect(dollarsToCents("12.34")).toBe(1234);
  });

  it("rounds correctly (no floating-point drift)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(dollarsToCents("not a number")).toBe(0);
  });

  it("handles whole dollars", () => {
    expect(dollarsToCents(100)).toBe(10000);
  });
});

describe("daysUntilDue", () => {
  it("returns null for null input", () => {
    expect(daysUntilDue(null)).toBe(null);
    expect(daysUntilDue(undefined)).toBe(null);
  });

  it("returns 0 for today", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(daysUntilDue(today)).toBe(0);
  });

  it("returns positive number for future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(daysUntilDue(future)).toBe(7);
  });

  it("returns negative number for past dates (overdue)", () => {
    const past = new Date();
    past.setDate(past.getDate() - 14);
    expect(daysUntilDue(past)).toBe(-14);
  });
});

describe("agingBucket", () => {
  function dateOffsetDays(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  it("returns null for null input", () => {
    expect(agingBucket(null)).toBe(null);
  });

  it("buckets current (not yet due) as 'current'", () => {
    expect(agingBucket(dateOffsetDays(15))).toBe("current");
    expect(agingBucket(dateOffsetDays(0))).toBe("current");
  });

  it("buckets 1-30 days overdue", () => {
    expect(agingBucket(dateOffsetDays(-1))).toBe("1-30");
    expect(agingBucket(dateOffsetDays(-30))).toBe("1-30");
  });

  it("buckets 31-60 days overdue", () => {
    expect(agingBucket(dateOffsetDays(-45))).toBe("31-60");
    expect(agingBucket(dateOffsetDays(-60))).toBe("31-60");
  });

  it("buckets 61-90 days overdue", () => {
    expect(agingBucket(dateOffsetDays(-75))).toBe("61-90");
    expect(agingBucket(dateOffsetDays(-90))).toBe("61-90");
  });

  it("buckets 90+ days overdue", () => {
    expect(agingBucket(dateOffsetDays(-91))).toBe("90+");
    expect(agingBucket(dateOffsetDays(-365))).toBe("90+");
  });

  it("has labels for every bucket", () => {
    const buckets = ["current", "1-30", "31-60", "61-90", "90+"] as const;
    for (const b of buckets) {
      expect(AGING_BUCKET_LABELS[b]).toBeTruthy();
    }
  });
});
