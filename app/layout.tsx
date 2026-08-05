import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "HWMS",
  description: "HGL Warehouse Management System",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthGuard />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
