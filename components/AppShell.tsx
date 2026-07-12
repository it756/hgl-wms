"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

const PUBLIC_PREFIXES = ["/forgot-password", "/external"];

function isPublicRoute(pathname: string) {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) return <>{children}</>;

  return <DashboardLayout>{children}</DashboardLayout>;
}
