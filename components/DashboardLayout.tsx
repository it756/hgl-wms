"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Warehouse,
  Users,
  Settings,
  ClipboardList,
  Layers,
  FileSpreadsheet,
  History,
  User,
  LogOut,
  Bell,
  HelpCircle,
  Grid,
  ArrowLeftRight,
  Plus,
  Menu,
  X,
  AlertTriangle,
  Building,
  CheckCircle,
  FileText,
  LayoutDashboard,
  RotateCcw,
  PackageCheck,
  ClipboardCheck,
  Flame,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("UNIT_STAFF");
  const [sbuName, setSbuName] = useState("Finance & Admin SBU");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for auth state changes (token expiry, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_OUT") {
          localStorage.clear();
          router.push("/");
        }
      }
    });

    // Verify session is still valid on mount
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (
        !session &&
        localStorage.getItem("access_token") &&
        localStorage.getItem("access_token") !== "demo-token-123456"
      ) {
        // Real session is gone — sign out and redirect
        localStorage.clear();
        router.push("/");
        return;
      }

      // Read cached metadata or session
      const role = localStorage.getItem("user_role") || "UNIT_STAFF";
      const name = localStorage.getItem("user_name") || "Alexander Wright";
      const sbu = localStorage.getItem("user_sbu") || "Finance & Admin SBU";

      setUserRole(role);
      setUserName(name);
      setSbuName(sbu);

      // Dynamic unread count
      fetchNotifications();

      const token = localStorage.getItem("access_token");
      if (!token && pathname !== "/" && pathname !== "/forgot-password") {
        localStorage.setItem("user_role", role);
        localStorage.setItem("user_name", name);
        localStorage.setItem("user_sbu", sbu);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [pathname]);

  // Close avatar popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchNotifications() {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        // dummy mock notifications if no live backend response
        setNotifications([
          {
            id: 1,
            type: "critical",
            title: "Critical Stock Alert",
            message: "Stock level for SKU HZ-9902-X has dropped below the safety threshold of 50 units. Immediate replenishment required.",
            time: "10:42 AM",
            read: false,
            entity: "HZ-9902-X",
            entity_label: "View Product",
            link: "/admin/products",
          },
          {
            id: 2,
            type: "delay",
            title: "Transfer Request Pending",
            message: "Transfer request TR-2024-0042 from Finance & Admin SBU has been awaiting warehouse approval for over 24 hours.",
            time: "09:15 AM",
            read: false,
            entity: "TR-2024-0042",
            entity_label: "View Request",
            link: "/warehouse/queue",
          },
          {
            id: 3,
            type: "return",
            title: "Return Request Submitted",
            message: "IT Supplies SBU submitted return RET-0089 for 12 units of Engine Oil 10W-40. Pending BU Manager approval.",
            time: "08:30 AM",
            read: false,
            entity: "RET-0089",
            entity_label: "View Return",
            link: "/returns/approvals",
          },
          {
            id: 4,
            type: "system",
            title: "System Maintenance Completed",
            message: "The Warehouse Optimization Engine v4.2.1 is now live. Batch issuance performance improved by 30%.",
            time: "Yesterday",
            read: true,
            entity: null,
            entity_label: null,
            link: null,
          },
        ]);
        setUnreadCount(3);
        return;
      }
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push("/");
  }

  // Define sidebar menu options by role
  const getMenuItems = () => {
    switch (userRole) {
      case "ADMIN":
        return [
          { href: "/admin", label: "Admin Panel", icon: Grid },
          { href: "/admin/users", label: "User Management", icon: Users },
          { href: "/admin/sbus", label: "SBU Registry", icon: Building },
          { href: "/admin/products", label: "Product Catalogue", icon: Layers },
          { href: "/admin/settings", label: "Global Settings", icon: Settings },
          { href: "/admin/exports", label: "Export Data", icon: FileSpreadsheet },
          { href: "/admin/audit", label: "Audit Trails", icon: History },
          { href: "/admin/variance", label: "Variance Resolution", icon: AlertTriangle },
          { href: "/admin/damage", label: "Damage Ledger", icon: Flame },
          { href: "/admin/expiry", label: "Expiry Ledger", icon: AlertTriangle },
        ];
      case "BU_MANAGER":
        return [
          { href: "/requests", label: "My Transfers", icon: ArrowLeftRight },
          { href: "/requests/new", label: "New Request", icon: Plus },
          { href: "/bu/queue", label: "BU Approval Queue", icon: ClipboardList },
          { href: "/requests/units", label: "Units & Staff", icon: Users },
          { href: "/returns/approvals", label: "Returns Approval", icon: ClipboardCheck },
          { href: "/variance", label: "Variance Decisions", icon: AlertTriangle },
          { href: "/bu/stock", label: "My Stock", icon: Layers },
        ];
      case "WAREHOUSE_MANAGER":
        return [
          { href: "/warehouse", label: "Dashboard", icon: LayoutDashboard },
          { href: "/warehouse/queue", label: "Warehouse Queue", icon: ClipboardList },
          { href: "/warehouse/supplier-grn", label: "Supplier GRN Queue", icon: FileText },
          { href: "/warehouse/returns", label: "Returns Incoming", icon: PackageCheck },
          { href: "/warehouse/intra-transfer", label: "Intra Transfers", icon: ArrowLeftRight },
          { href: "/warehouse/losses", label: "Loss Account", icon: TrendingDown },
          { href: "/admin/products", label: "Product Catalogue", icon: Layers },
          { href: "/admin/damage", label: "Damage Ledger", icon: Flame },
          { href: "/admin/expiry", label: "Expiry Ledger", icon: AlertTriangle },
        ];
      case "FINANCE_MANAGER":
        return [
          { href: "/finance/queue", label: "Pending Approvals", icon: ClipboardList },
          { href: "/finance/catalogue", label: "Catalogue", icon: Layers },
          { href: "/admin/damage", label: "Damage Ledger", icon: Flame },
          { href: "/admin/expiry", label: "Expiry Ledger", icon: AlertTriangle },
        ];
      default: // UNIT_STAFF
        return [
          { href: "/requests", label: "My Transfers", icon: ArrowLeftRight },
          { href: "/requests/new", label: "New Request", icon: Plus },
          { href: "/grn/submit", label: "Receive GRN", icon: CheckCircle },
          { href: "/returns", label: "My Returns", icon: RotateCcw },
          { href: "/returns/new", label: "New Return", icon: Plus },
          { href: "/bu/stock", label: "My Stock", icon: Layers },
        ];
    }
  };

  const menuItems = getMenuItems();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-[260px] bg-[#1E293B] text-slate-100 flex flex-col z-30 hidden lg:flex">
        {/* Brand identity */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center gap-2.5">
          <Warehouse className="text-primary text-teal-400 w-7 h-7" />
          <span className="font-extrabold text-xl tracking-tight text-white font-sans uppercase">
            Harvest WMS
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 py-3 px-6 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-white border-l-4 border-teal-400"
                    : "text-slate-300 opacity-80 hover:opacity-100 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-5 h-5 text-current" />
                {item.label}
              </Link>
            );
          })}
        </nav>


      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col lg:pl-[260px] relative">
        {/* TopAppBar */}
        <header className="sticky top-0 z-40 w-full h-16 px-6 bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1 text-on-surface-variant hover:bg-surface-container-low rounded-lg lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="font-bold text-lg md:text-xl text-on-surface">
              Good Day, {userName.split(" ")[0]}
            </h2>
            <div className="h-6 w-px bg-outline-variant hidden sm:block"></div>
            <div className="bg-surface-container-low border border-outline-variant text-[11px] md:text-xs text-on-surface-variant px-3 py-1 rounded-full font-bold hidden sm:flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              {sbuName}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            {/* Notification and Apps Group */}
            <div className="flex items-center gap-1.5 relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full animate-pulse"></span>
                )}
              </button>
              <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors hidden sm:block">
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* Quick Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-outline-variant rounded-xl shadow-lg z-50 p-4">
                  <div className="flex justify-between items-center pb-2 border-b border-outline-variant mb-3">
                    <h3 className="font-bold text-sm text-on-surface">Recent Alerts</h3>
                    <Link
                      href="/notifications"
                      className="text-xs text-primary font-bold hover:underline"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      All Alerts ({unreadCount})
                    </Link>
                  </div>
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 border rounded-lg flex flex-col gap-1.5 ${
                          n.read ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              n.type === "critical"
                                ? "bg-red-50 text-red-700"
                                : n.type === "return"
                                ? "bg-amber-50 text-amber-700"
                                : n.type === "system"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-blue-50 text-sky-700"
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-3">{n.message}</p>
                        {(n.entity || n.link) && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-0.5">
                            {n.entity && (
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                {n.entity}
                              </span>
                            )}
                            {n.link && (
                              <Link
                                href={n.link}
                                onClick={() => setNotificationsOpen(false)}
                                className="text-[10px] font-bold text-primary hover:underline ml-auto"
                              >
                                {n.entity_label ?? "View"} →
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar with popover */}
            <div className="relative flex items-center gap-3 border-l border-outline-variant pl-4 py-1" ref={avatarRef}>
              <div className="text-right hidden md:block">
                <p className="font-semibold text-sm text-on-surface leading-none">{userName}</p>
                <p className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full mt-1 inline-block border border-slate-200">
                  {userRole}
                </p>
              </div>
              <button
                onClick={() => setAvatarMenuOpen((v) => !v)}
                className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold border-2 border-primary font-mono text-sm shadow-sm select-none hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Open profile menu"
              >
                {userName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </button>

              {/* Avatar popover */}
              {avatarMenuOpen && (
                <div className="absolute right-0 top-14 w-64 bg-white border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="font-bold text-sm text-[#1E293B] truncate">{userName}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{userRole}</p>
                  </div>
                  {/* Actions */}
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      My Profile
                    </Link>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors font-medium w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Actual Dynamic Workspace */}
        <main className="flex-1 p-5 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>

      {/* Mobile Drawer Slide-out */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 z-50 flex lg:hidden">
          <div className="w-[260px] bg-[#1E293B] text-slate-100 flex flex-col p-4 animate-slide-in">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Warehouse className="text-teal-400 w-6 h-6" />
                <span className="font-bold text-lg text-white">Harvest WMS</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3.5 py-2.5 px-4 text-sm font-semibold rounded transition-all ${
                      isActive
                        ? "bg-primary text-white border-l-4 border-teal-400"
                        : "text-slate-300 opacity-80 hover:opacity-100 hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-white/10 pt-4 mt-auto flex flex-col gap-1">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3.5 py-2.5 px-4 text-sm text-slate-300 opacity-80 hover:opacity-100 hover:bg-slate-800 rounded transition-all font-semibold"
              >
                <User className="w-5 h-5" />
                My Profile
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3.5 py-2.5 px-4 w-full text-sm text-rose-300 hover:bg-slate-800 rounded transition-all font-semibold"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}
    </div>
  );
}
