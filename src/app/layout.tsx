import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

// Single visual primitive for every toast: same dark pill, same shape;
// the icon's color is the only thing that varies by type.
const TOAST_CLASS =
  "flex items-start gap-2.5 w-[360px] max-w-[calc(100vw-32px)] px-3.5 py-3 " +
  "rounded-[10px] bg-[var(--ink)] text-[var(--paper)] border border-[var(--ink)] " +
  "shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)] " +
  "font-sans text-[13px] leading-[1.4]";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trashlab Payables",
  description: "Accounts payable for teams that move fast.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AppHeader />
        <main className="flex-1">{children}</main>
        <Toaster
          position="top-center"
          closeButton
          theme="light"
          icons={{
            success: <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.72_0.13_150)]" />,
            error:   <XCircle      className="h-3.5 w-3.5 text-[oklch(0.72_0.16_25)]"  />,
            warning: <AlertTriangle className="h-3.5 w-3.5 text-[oklch(0.78_0.14_80)]" />,
            info:    <Info         className="h-3.5 w-3.5 text-[oklch(0.85_0.012_65)]" />,
          }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: TOAST_CLASS,
              title: "font-medium text-[var(--paper)]",
              description: "mt-0.5 text-[12px] text-[oklch(0.85_0.012_65)]",
              icon: "inline-flex items-center justify-center w-4 h-4 flex-none mt-0.5",
              closeButton:
                "!border-0 !bg-transparent !text-[oklch(0.7_0.012_65)] hover:!text-[var(--paper)] !w-4 !h-4",
            },
          }}
        />
      </body>
    </html>
  );
}
