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

/**
 * Additional accounting dimensions a split can carry. Like CATEGORIES, in a
 * real product these would sync from the customer's chart of accounts; for the
 * MVP they're hardcoded. An empty string ("") on a split means "unassigned".
 */
export const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Sales",
  "Marketing",
  "Customer Success",
  "Finance",
  "People",
  "Operations",
] as const;

export const GL_ACCOUNTS = [
  "6000 · Software & SaaS",
  "6100 · R&D",
  "6200 · Advertising",
  "6300 · Travel & Entertainment",
  "6400 · Office & Supplies",
  "6500 · Professional Services",
  "6600 · Payroll",
  "7000 · Other Expense",
] as const;

export const LOCATIONS = [
  "HQ — San Francisco",
  "New York",
  "Austin",
  "London",
  "Remote",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
export type GlAccount = (typeof GL_ACCOUNTS)[number];
export type Location = (typeof LOCATIONS)[number];

/**
 * A single allocation slice of a line item. `category` is required; the other
 * accounting dimensions are optional (empty string / null = unassigned). The
 * money weight is always basis points — never percent — see `allocateCents`.
 */
export type LineItemSplit = {
  category: string;
  department?: string | null;
  glAccount?: string | null;
  location?: string | null;
  percentageBps: number; // 10000 = 100%
};

export const TOTAL_BPS = 10000;

/** Max slices per line item (and per saved template). Mirrors Ramp's limit. */
export const MAX_SPLITS = 150;

export function isSplitsValid(splits: LineItemSplit[] | null | undefined): boolean {
  if (!splits || splits.length === 0) return true; // Uncategorized is OK
  if (splits.length > MAX_SPLITS) return false;
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

/** A split with its money weight resolved to integer cents. */
export type AllocatedSplit = Omit<LineItemSplit, "percentageBps"> & { cents: number };

/**
 * Allocates a cents amount across splits, rounding down on each split and
 * dropping leftover cents on the largest split (prevents +/- 1¢ drift).
 * Preserves every accounting dimension on each split (category/department/etc.)
 * so downstream roll-ups can group by any dimension.
 */
export function allocateCents(
  totalCents: number,
  splits: LineItemSplit[]
): AllocatedSplit[] {
  if (splits.length === 0) return [];
  const allocated = splits.map((s) => {
    const { percentageBps, ...dimensions } = s;
    return {
      ...dimensions,
      cents: Math.floor((totalCents * percentageBps) / TOTAL_BPS),
    };
  });
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
