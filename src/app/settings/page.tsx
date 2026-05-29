import Link from "next/link";
import { ArrowRight, SlidersHorizontal } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-7">
      <div>
        <span className="micro">Settings</span>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-faint">
          Configure reusable building blocks for your accounts payable workflow.
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        <Link
          href="/settings/allocation-templates"
          className="surface focus-ring group flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-sunken"
        >
          <span
            className="grid h-8 w-8 flex-none place-items-center rounded-lg"
            style={{ background: "var(--paper-sunken)", color: "var(--ink-2)" }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">Allocation templates</div>
            <div className="mt-0.5 text-[12px] text-ink-faint">
              Manage reusable split configurations to apply across line items.
            </div>
          </div>
          <ArrowRight
            className="h-3.5 w-3.5 flex-none transition-transform group-hover:translate-x-0.5"
            style={{ color: "var(--ink-fainter)" }}
          />
        </Link>
      </div>
    </div>
  );
}
