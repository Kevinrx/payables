import { getInitials } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-10 w-10 text-[12px]",
  lg: "h-12 w-12 text-[13px] sm:h-14 sm:w-14 sm:text-[15px]",
};

export function VendorAvatar({ name, size = "sm" }: { name: string; size?: Size }) {
  return (
    <span
      aria-hidden
      className={`grid flex-none place-items-center rounded-md font-semibold uppercase ${SIZE_CLASSES[size]}`}
      style={{
        fontFamily: "var(--font-geist-mono), monospace",
        background: "var(--paper-sunken)",
        color: "var(--ink-2)",
        border: "1px solid var(--rule)",
      }}
    >
      {getInitials(name)}
    </span>
  );
}
