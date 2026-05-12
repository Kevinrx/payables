import { formatMoney } from "@/lib/utils";

export type AgingTone = "neutral" | "warning" | "danger";

export function agingToneColor(tone: AgingTone, isZero: boolean): string {
  if (isZero) return "var(--ink-fainter)";
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "var(--warn-strong)";
  return "var(--ink)";
}

export function BucketCard({
  label,
  cents,
  tone,
  grand,
}: {
  label: string;
  cents: number;
  tone: AgingTone;
  grand: number;
}) {
  const isZero = cents === 0;
  const pct = grand > 0 ? (cents / grand) * 100 : 0;
  const color = agingToneColor(tone, isZero);
  return (
    <div className="surface px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="micro">{label}</div>
      <div
        className="mt-2 truncate text-[17px] leading-none font-semibold tabular tracking-tight font-mono sm:text-[22px] lg:text-[26px]"
        style={{ color }}
        title={formatMoney(cents)}
      >
        {formatMoney(cents)}
      </div>
      <div
        className="mt-3 h-1 rounded-full overflow-hidden"
        style={{ background: "var(--rule-faint)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(pct, 100)}%`, background: isZero ? "transparent" : color }}
        />
      </div>
      <div
        className="mt-2 text-[10.5px] uppercase tracking-[0.08em] tabular"
        style={{ color: "var(--ink-faint)" }}
      >
        {pct.toFixed(1)}% of total
      </div>
    </div>
  );
}

export function BucketCell({
  cents,
  tone = "neutral",
}: {
  cents: number;
  tone?: AgingTone;
}) {
  const isZero = cents === 0;
  const color = agingToneColor(tone, isZero);
  return (
    <td
      className="px-4 py-3 text-right text-[13px] font-mono tabular"
      style={{
        color,
        fontWeight: tone === "danger" && !isZero ? 600 : undefined,
      }}
    >
      {isZero ? "—" : formatMoney(cents)}
    </td>
  );
}
