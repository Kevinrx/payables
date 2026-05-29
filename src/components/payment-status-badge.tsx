import type { PaymentStatus } from "@/db/schema";
import { PAYMENT_STATUS_DISPLAY } from "@/lib/payments";
import { cn } from "@/lib/utils";

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const s = PAYMENT_STATUS_DISPLAY[status];
  return <span className={cn("pill", s.cls, className)}>{s.label}</span>;
}
