import type { BillDetail } from "@/db/queries";
import { formatDate, formatMoney } from "@/lib/utils";

export function PaymentsTable({ bill }: { bill: BillDetail }) {
  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border px-[18px] py-3.5">
        <span className="micro">Payments ({bill.payments.length})</span>
      </div>
      <div className="p-[18px]">
        {bill.payments.length === 0 ? (
          <p className="text-[13px] text-ink-faint">
            No payments yet. Approve this bill, then schedule a payment when you&apos;re ready.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-[18px] px-[18px]">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2"><span className="micro">Scheduled</span></th>
                  <th className="pb-2"><span className="micro">Paid</span></th>
                  <th className="pb-2"><span className="micro">Method</span></th>
                  <th className="pb-2"><span className="micro">Status</span></th>
                  <th className="pb-2 text-right"><span className="micro">Amount</span></th>
                </tr>
              </thead>
              <tbody>
                {bill.payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 tabular font-mono">{formatDate(p.scheduledFor)}</td>
                    <td className="py-3 tabular font-mono">
                      {p.paidAt ? formatDate(p.paidAt) : <span className="text-ink-fainter">—</span>}
                    </td>
                    <td className="py-3 uppercase text-[11px] tracking-wider font-mono">{p.method}</td>
                    <td className="py-3 capitalize">{p.status}</td>
                    <td className="py-3 text-right tabular font-mono font-medium">
                      {formatMoney(p.amountCents, bill.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
