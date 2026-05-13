import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const TOAST_DURATION_MS = 4000;

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
            success: <CheckCircle2 strokeWidth={1.8} />,
            error:   <XCircle strokeWidth={1.8} />,
            warning: <AlertTriangle strokeWidth={1.8} />,
            info:    <Info strokeWidth={1.8} />,
          }}
          toastOptions={{
            unstyled: true,
            duration: TOAST_DURATION_MS,
            classNames: {
              toast: "tt-toast",
              title: "tt-title",
              description: "tt-description",
              icon: "tt-icon",
              closeButton: "tt-close",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}
