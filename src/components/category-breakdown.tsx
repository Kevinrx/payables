import type { BillDetail } from "@/db/queries";
import { allocateCents, type LineItemSplit } from "@/lib/categories";
import { formatMoney } from "@/lib/utils";

export function hasAnySplits(bill: BillDetail): boolean {
  return bill.lineItems.some((li) => {
    const s = li.splits as LineItemSplit[] | null;
    return s && s.length > 0;
  });
}

export function CategoryBreakdown({ bill }: { bill: BillDetail }) {
  const totals = new Map<string, number>();
  let uncategorized = 0;
  for (const li of bill.lineItems) {
    const splits = (li.splits as LineItemSplit[] | null) ?? null;
    if (!splits || splits.length === 0) {
      uncategorized += li.amountCents;
      continue;
    }
    for (const a of allocateCents(li.amountCents, splits)) {
      totals.set(a.category, (totals.get(a.category) ?? 0) + a.cents);
    }
  }
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0) + uncategorized;

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border px-[18px] py-3.5">
        <span className="micro">Category breakdown</span>
      </div>
      <div className="p-[18px]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2"><span className="micro">Category</span></th>
              <th className="pb-2 text-right"><span className="micro">Amount</span></th>
              <th className="pb-2 text-right"><span className="micro">% of total</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([cat, cents]) => (
              <tr key={cat} className="border-b border-border last:border-b-0">
                <td className="py-2.5">{cat}</td>
                <td className="py-2.5 text-right tabular font-mono font-medium">
                  {formatMoney(cents, bill.currency)}
                </td>
                <td className="py-2.5 text-right tabular font-mono text-ink-faint">
                  {grandTotal > 0 ? ((cents / grandTotal) * 100).toFixed(1) : "0"}%
                </td>
              </tr>
            ))}
            {uncategorized > 0 && (
              <tr className="border-b border-border last:border-b-0 text-ink-faint">
                <td className="py-2.5 italic">Uncategorized</td>
                <td className="py-2.5 text-right tabular font-mono">
                  {formatMoney(uncategorized, bill.currency)}
                </td>
                <td className="py-2.5 text-right tabular font-mono">
                  {grandTotal > 0 ? ((uncategorized / grandTotal) * 100).toFixed(1) : "0"}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
