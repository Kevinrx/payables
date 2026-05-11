/**
 * Hardcoded category list for line-item splits. In a real product these would
 * come from the customer's chart of accounts (synced from QBO/Xero/Netsuite).
 * For an MVP, hardcoded keeps the UX clear without an extra setup step.
 */
export const CATEGORIES = [
  "Engineering / R&D",
  "Product",
  "Sales",
  "Marketing",
  "Customer Support",
  "Operations",
  "G&A",
  "Travel",
  "Software & SaaS",
  "Office",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type LineItemSplit = {
  category: string;
  percentageBps: number; // 10000 = 100%
};

export const TOTAL_BPS = 10000;

export function isSplitsValid(splits: LineItemSplit[] | null | undefined): boolean {
  if (!splits || splits.length === 0) return true; // Uncategorized is OK
  if (splits.some((s) => !s.category || s.percentageBps <= 0)) return false;
  const sum = splits.reduce((acc, s) => acc + s.percentageBps, 0);
  return sum === TOTAL_BPS;
}

export function bpsToPct(bps: number): number {
  return Math.round((bps / 100) * 100) / 100;
}

export function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}

/**
 * Allocates a cents amount across splits, rounding down on each split and
 * dropping leftover cents on the largest split (prevents +/- 1¢ drift).
 */
export function allocateCents(
  totalCents: number,
  splits: LineItemSplit[]
): Array<{ category: string; cents: number }> {
  if (splits.length === 0) return [];
  const allocated = splits.map((s) => ({
    category: s.category,
    cents: Math.floor((totalCents * s.percentageBps) / TOTAL_BPS),
  }));
  const drift = totalCents - allocated.reduce((sum, a) => sum + a.cents, 0);
  if (drift !== 0) {
    let largestIdx = 0;
    for (let i = 1; i < allocated.length; i++) {
      if (allocated[i].cents > allocated[largestIdx].cents) largestIdx = i;
    }
    allocated[largestIdx].cents += drift;
  }
  return allocated;
}

export function formatSplitSummary(splits: LineItemSplit[] | null | undefined): string {
  if (!splits || splits.length === 0) return "Uncategorized";
  if (splits.length === 1) return splits[0].category;
  return splits
    .map((s) => `${bpsToPct(s.percentageBps).toFixed(0)}% ${s.category}`)
    .join(" · ");
}
