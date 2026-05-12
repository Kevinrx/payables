import { Check } from "lucide-react";
import type { BillStatus } from "@/db/schema";

const STEPS: { id: BillStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "needs_review", label: "Review" },
  { id: "approved", label: "Approved" },
  { id: "scheduled", label: "Scheduled" },
  { id: "paid", label: "Paid" },
];

export function LifecycleStepper({
  status,
  actions,
}: {
  status: BillStatus;
  actions: React.ReactNode;
}) {
  const stepIdx = STEPS.findIndex((s) => s.id === status);
  const activeStep = STEPS[stepIdx];
  return (
    <div className="surface flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-3.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center flex-wrap gap-y-2 min-w-0">
        {STEPS.map((s, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-semibold flex-none ${active ? "pulse-ring" : ""}`}
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    background: done ? "var(--ink)" : active ? "var(--brand)" : "var(--paper-sunken)",
                    color: done ? "var(--paper)" : active ? "var(--brand-fg)" : "var(--ink-fainter)",
                    border: done || active ? "none" : "1px solid var(--rule-strong)",
                  }}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                </span>
                {/* Inline label hidden on phones; replaced by a single active-step label below */}
                <span
                  className="hidden text-[12.5px] whitespace-nowrap sm:inline"
                  style={{
                    color: active ? "var(--ink)" : done ? "var(--ink-2)" : "var(--ink-fainter)",
                    fontWeight: active ? 600 : 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className="mx-1.5 h-px w-3 flex-none sm:mx-2 sm:w-5"
                  style={{ background: i < stepIdx ? "var(--ink)" : "var(--rule)" }}
                />
              )}
            </div>
          );
        })}
        {/* Compact active-step label for mobile */}
        {activeStep && (
          <span
            className="ml-3 inline text-[12.5px] font-semibold tracking-tight sm:hidden"
            style={{ color: "var(--ink)" }}
          >
            {activeStep.label}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:flex-none">{actions}</div>
    </div>
  );
}
