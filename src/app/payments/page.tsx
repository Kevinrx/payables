import { getDemoOrgId, getPaymentsSummary, listPayments } from "@/db/queries";
import { PaymentSummaryCards } from "@/components/payment-summary-cards";
import { PaymentsList } from "@/components/payments-list";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const orgId = await getDemoOrgId();
  const [summary, rows] = await Promise.all([
    getPaymentsSummary(orgId),
    listPayments(orgId),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-[13px] text-ink-faint">
          Track and action payments after a bill is approved — release, reschedule, or mark them paid.
        </p>
      </div>

      <div className="mt-6">
        <PaymentSummaryCards summary={summary} />
      </div>

      <div className="mt-7">
        <PaymentsList rows={rows} />
      </div>
    </div>
  );
}
