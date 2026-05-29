import type { ComponentType } from "react";
import { CalendarClock, CalendarX, RotateCcw, Send, Wallet, X } from "lucide-react";
import type { PaymentAction } from "@/lib/payments";

// Single source for the icon (and presentation) of each payment action, shared
// by the per-row menu (payment-actions) and the bulk bar (payment-bulk-bar) so
// they can't diverge. Labels live with the logic in @/lib/payments.
export const PAYMENT_ACTION_ICON: Record<
  PaymentAction,
  ComponentType<{ className?: string }>
> = {
  release: Send,
  markPaid: Wallet,
  editDate: CalendarClock,
  unschedule: CalendarX,
  cancel: X,
  retry: RotateCcw,
};

// Presentation order in the bulk action bar.
export const BULK_ACTION_ORDER: PaymentAction[] = [
  "release",
  "markPaid",
  "retry",
  "editDate",
  "unschedule",
  "cancel",
];

export const DANGER_ACTIONS = new Set<PaymentAction>(["cancel"]);
