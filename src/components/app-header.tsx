import Link from "next/link";
import { Receipt } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/bills" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
              <Receipt className="h-4 w-4" />
            </span>
            <span>Trashlab Payables</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <Link
              href="/bills"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Bills
            </Link>
            <Link
              href="/vendors"
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Vendors
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Demo workspace
          </div>
          <Link
            href="/bills/new"
            className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
          >
            New bill
          </Link>
        </div>
      </div>
    </header>
  );
}
