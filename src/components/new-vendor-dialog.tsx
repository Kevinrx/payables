"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createVendor } from "@/app/vendors/actions";

type Method = "ach" | "check" | "card";

const METHODS: { id: Method; label: string }[] = [
  { id: "ach", label: "ACH" },
  { id: "check", label: "Check" },
  { id: "card", label: "Card" },
];

export function NewVendorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<Method>("ach");

  function reset() {
    setName("");
    setEmail("");
    setMethod("ach");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createVendor({ name, email, defaultPaymentMethod: method });
      if (res.ok) {
        toast.success("Vendor created", { description: name });
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("Could not create vendor", { description: res.error });
      }
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(20,18,14,0.32)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fade-up w-full max-w-[460px] overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 14,
          boxShadow: "var(--shadow-pop)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex items-start justify-between px-[18px] py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
            >
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">New vendor</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                Add a supplier so you can attach bills to them.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-[18px] py-4">
          <div>
            <label className="micro" htmlFor="vendor-name">Name</label>
            <input
              id="vendor-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Cloud Services"
              className="input mt-1 w-full"
            />
          </div>

          <div>
            <label className="micro" htmlFor="vendor-email">Email <span className="text-ink-fainter">(optional)</span></label>
            <input
              id="vendor-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ap@vendor.com"
              className="input mt-1 w-full"
            />
          </div>

          <div>
            <span className="micro">Default payment method</span>
            <div className="mt-1 tabs">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="tab"
                  data-active={method === m.id}
                  onClick={() => setMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="btn btn-brand"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Create vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
