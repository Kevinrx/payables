import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

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
          toastOptions={{
            style: {
              background: "var(--ink)",
              color: "var(--paper)",
              border: "1px solid var(--ink)",
              borderRadius: "8px",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
