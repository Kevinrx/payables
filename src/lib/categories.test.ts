import { describe, it, expect } from "vitest";
import {
  isSplitsValid,
  allocateCents,
  bpsToPct,
  pctToBps,
  formatSplitSummary,
  TOTAL_BPS,
  type LineItemSplit,
} from "./categories";

describe("bps <-> pct", () => {
  it("converts 100% to 10000 bps", () => {
    expect(pctToBps(100)).toBe(10000);
    expect(bpsToPct(10000)).toBe(100);
  });

  it("converts fractional percentages", () => {
    expect(pctToBps(33.33)).toBe(3333);
    expect(bpsToPct(3333)).toBe(33.33);
  });

  it("round-trips", () => {
    for (const pct of [0, 10, 25, 33.33, 50, 66.67, 100]) {
      expect(bpsToPct(pctToBps(pct))).toBeCloseTo(pct, 2);
    }
  });
});

describe("isSplitsValid", () => {
  it("treats null/empty splits as valid (uncategorized)", () => {
    expect(isSplitsValid(null)).toBe(true);
    expect(isSplitsValid(undefined)).toBe(true);
    expect(isSplitsValid([])).toBe(true);
  });

  it("accepts splits that sum to exactly 100%", () => {
    expect(
      isSplitsValid([
        { category: "R&D", percentageBps: 6000 },
        { category: "Sales", percentageBps: 4000 },
      ])
    ).toBe(true);
  });

  it("rejects splits that don't sum to 100%", () => {
    expect(
      isSplitsValid([
        { category: "R&D", percentageBps: 5000 },
        { category: "Sales", percentageBps: 4000 },
      ])
    ).toBe(false);

    expect(
      isSplitsValid([
        { category: "R&D", percentageBps: 6000 },
        { category: "Sales", percentageBps: 5000 },
      ])
    ).toBe(false);
  });

  it("rejects splits with empty category names", () => {
    expect(
      isSplitsValid([
        { category: "", percentageBps: 5000 },
        { category: "Sales", percentageBps: 5000 },
      ])
    ).toBe(false);
  });

  it("rejects splits with zero or negative percentages", () => {
    expect(
      isSplitsValid([
        { category: "R&D", percentageBps: 0 },
        { category: "Sales", percentageBps: 10000 },
      ])
    ).toBe(false);
  });
});

describe("allocateCents", () => {
  it("splits cents proportionally", () => {
    const splits: LineItemSplit[] = [
      { category: "R&D", percentageBps: 6000 },
      { category: "Sales", percentageBps: 4000 },
    ];
    const allocated = allocateCents(100_00, splits);
    expect(allocated).toEqual([
      { category: "R&D", cents: 60_00 },
      { category: "Sales", cents: 40_00 },
    ]);
  });

  it("never loses cents to rounding (drift lands on largest split)", () => {
    // $100.01 split 3 ways evenly -- can't divide evenly, must not drop a cent
    const splits: LineItemSplit[] = [
      { category: "A", percentageBps: 3333 },
      { category: "B", percentageBps: 3333 },
      { category: "C", percentageBps: 3334 },
    ];
    const allocated = allocateCents(100_01, splits);
    const sum = allocated.reduce((s, a) => s + a.cents, 0);
    expect(sum).toBe(100_01);
  });

  it("handles single-category 100% allocation", () => {
    const allocated = allocateCents(123_45, [
      { category: "Software", percentageBps: 10000 },
    ]);
    expect(allocated).toEqual([{ category: "Software", cents: 123_45 }]);
  });

  it("returns empty array for empty splits", () => {
    expect(allocateCents(100_00, [])).toEqual([]);
  });

  it("preserves total even with awkward percentages", () => {
    // 7-way split — drift will be non-trivial
    const splits: LineItemSplit[] = Array.from({ length: 7 }, (_, i) => ({
      category: `Cat${i}`,
      percentageBps: Math.floor(TOTAL_BPS / 7),
    }));
    // Adjust last to make it sum to TOTAL_BPS
    splits[6].percentageBps = TOTAL_BPS - splits.slice(0, 6).reduce((s, x) => s + x.percentageBps, 0);
    const allocated = allocateCents(999_99, splits);
    const sum = allocated.reduce((s, a) => s + a.cents, 0);
    expect(sum).toBe(999_99);
  });
});

describe("formatSplitSummary", () => {
  it("returns 'Uncategorized' for null/empty", () => {
    expect(formatSplitSummary(null)).toBe("Uncategorized");
    expect(formatSplitSummary([])).toBe("Uncategorized");
  });

  it("returns just the category name when there's one split", () => {
    expect(
      formatSplitSummary([{ category: "Software & SaaS", percentageBps: 10000 }])
    ).toBe("Software & SaaS");
  });

  it("joins multiple splits with percentages", () => {
    const out = formatSplitSummary([
      { category: "R&D", percentageBps: 6000 },
      { category: "Sales", percentageBps: 4000 },
    ]);
    expect(out).toContain("60% R&D");
    expect(out).toContain("40% Sales");
  });
});
