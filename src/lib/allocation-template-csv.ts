import {
  isSplitsValid,
  lineItemSplitSchema,
  pctToBps,
  MAX_SPLITS,
  type LineItemSplit,
} from "./categories";

/**
 * One CSV row of an allocation-template upload. Each row is a single split
 * line; rows sharing a `template_name` are grouped into one template. Values
 * arrive as strings from the CSV parser.
 */
export type TemplateCsvRow = {
  template_name: string;
  category: string;
  department?: string | null;
  gl_account?: string | null;
  location?: string | null;
  percentage: string | number;
};

export type GroupedTemplate = { name: string; splits: LineItemSplit[] };

export type GroupTemplatesResult = {
  /** Templates that grouped + validated cleanly. */
  templates: GroupedTemplate[];
  /** Human-readable reasons for templates that were rejected. */
  errors: string[];
};

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePercent(value: string | number): number {
  if (typeof value === "number") return value;
  // tolerate "60", "60%", "33.33%", " 40 "
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Groups flat CSV rows into named allocation templates, converting percentages
 * to basis points and validating each group (category present, percentages
 * positive, ≤150 lines, sum === 100%). Pure — no DB, no dedup against existing
 * templates (the server action owns persistence + the 200-template cap).
 */
export function groupCsvRowsToTemplates(
  rows: TemplateCsvRow[]
): GroupTemplatesResult {
  const order: string[] = [];
  const byName = new Map<string, { rows: TemplateCsvRow[] }>();

  for (const row of rows) {
    const name = clean(row.template_name);
    if (!name) continue; // skip nameless rows silently; reported via empty result
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { rows: [] });
      order.push(key);
    }
    byName.get(key)!.rows.push({ ...row, template_name: name });
  }

  const templates: GroupedTemplate[] = [];
  const errors: string[] = [];

  for (const key of order) {
    const group = byName.get(key)!;
    const name = clean(group.rows[0].template_name)!;

    if (group.rows.length > MAX_SPLITS) {
      errors.push(`"${name}": ${group.rows.length} lines exceeds the 150 limit`);
      continue;
    }

    const splits: LineItemSplit[] = [];
    let rowError: string | null = null;

    for (const r of group.rows) {
      const category = clean(r.category);
      if (!category) {
        rowError = `"${name}": every line needs a category`;
        break;
      }
      const pct = parsePercent(r.percentage);
      if (!Number.isFinite(pct) || pct <= 0) {
        rowError = `"${name}": invalid percentage on "${category}"`;
        break;
      }
      const split: LineItemSplit = {
        category,
        department: clean(r.department),
        glAccount: clean(r.gl_account),
        location: clean(r.location),
        percentageBps: pctToBps(pct),
      };
      // Reject category/dimension values that aren't in the chart-of-accounts
      // lists (matching the editor's <select>s), so an imported value can't end
      // up rendering blank and getting silently overwritten on the next edit.
      const check = lineItemSplitSchema.safeParse(split);
      if (!check.success) {
        rowError = `"${name}": ${check.error.issues[0]?.message ?? "invalid value"} ("${category}")`;
        break;
      }
      splits.push(split);
    }

    if (rowError) {
      errors.push(rowError);
      continue;
    }

    if (!isSplitsValid(splits)) {
      const sumPct =
        splits.reduce((acc, s) => acc + s.percentageBps, 0) / 100;
      errors.push(`"${name}": splits sum to ${sumPct}% (must be 100%)`);
      continue;
    }

    templates.push({ name, splits });
  }

  return { templates, errors };
}
