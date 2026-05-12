type Size = "sm" | "md";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-1.5 py-px text-[10px]",
  md: "px-2 py-0.5 text-[10.5px]",
};

export function MethodPill({
  method,
  size = "md",
}: {
  method: string | null | undefined;
  size?: Size;
}) {
  if (!method) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold uppercase tracking-[0.08em] ${SIZE_CLASSES[size]}`}
      style={{
        fontFamily: "var(--font-geist-mono), monospace",
        background: "var(--paper-sunken)",
        color: "var(--ink-2)",
        border: "1px solid var(--rule)",
      }}
    >
      {method}
    </span>
  );
}
