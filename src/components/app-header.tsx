import Link from "next/link";
import { Receipt } from "lucide-react";

export function AppHeader() {
  return (
    <header
      className="sticky top-0 z-30 border-b border-border"
      style={{
        background: "color-mix(in oklch, var(--paper) 88%, transparent)",
        backdropFilter: "saturate(140%) blur(8px)",
        WebkitBackdropFilter: "saturate(140%) blur(8px)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-7 px-4 sm:px-7">
        <Link href="/bills" className="flex items-center gap-2.5">
          <span
            className="grid h-[26px] w-[26px] place-items-center rounded-md text-paper"
            style={{
              background: "var(--ink)",
              boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <Receipt className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span className="text-[14.5px] font-semibold tracking-tight">Trashlab</span>
          <span className="text-[14.5px] text-ink-faint">Payables</span>
        </Link>
        <nav className="hidden items-center gap-0.5 sm:flex">
          <HeaderLink href="/bills" label="Bills" />
          <HeaderLink href="/aging" label="Aging" />
          <HeaderLink href="/vendors" label="Vendors" />
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="h-[30px] rounded-md px-3 text-[13px] font-medium text-ink-faint inline-flex items-center transition-colors hover:bg-paper-sunken hover:text-ink"
    >
      {label}
    </Link>
  );
}
