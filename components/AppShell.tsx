"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

const PUBLIC_PREFIXES = ["/forgot-password", "/external"];
const SILOED_PREFIXES = ["/internal-control"];

function isPublicRoute(pathname: string) {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSiloedRoute(pathname: string) {
  return SILOED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname) || isSiloedRoute(pathname)) return <>{children}</>;

  return <DashboardLayout>{children}</DashboardLayout>;
}
