"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Bell, CheckCheck, AlertTriangle, Info, Package, ArrowLeftRight } from "lucide-react";
import type { Notification } from "@/lib/models/shared";

const TYPE_STYLES: Record<string, { icon: React.ReactNode; badge: string }> = {
  critical: {
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
    badge: "bg-red-50 text-red-700 border border-red-200",
  },
  transfer: {
    icon: <ArrowLeftRight className="w-4 h-4 text-sky-600" />,
    badge: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  grn: {
    icon: <Package className="w-4 h-4 text-emerald-600" />,
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  system: {
    icon: <Info className="w-4 h-4 text-slate-500" />,
    badge: "bg-slate-50 text-slate-600 border border-slate-200",
  },
};

function getTypeStyle(type: string) {
  return TYPE_STYLES[type] ?? TYPE_STYLES.system;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    const token = localStorage.getItem("access_token");
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    setMarkingAll(true);
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) => markRead(n.id)));
    setMarkingAll(false);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-on-surface">Notifications</h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-on-surface-variant">
            <Bell className="w-10 h-10 opacity-30" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const style = getTypeStyle(n.type);
              return (
                <div
                  key={n.id}
                  className={`flex gap-4 p-4 rounded-xl border transition-colors ${
                    n.is_read
                      ? "bg-surface-container-lowest border-outline-variant opacity-60"
                      : "bg-white border-outline-variant shadow-sm"
                  }`}
                >
                  <div className="mt-0.5">{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${style.badge}`}
                      >
                        {n.type}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono ml-auto shrink-0">
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface leading-snug">{n.message}</p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="self-start mt-0.5 text-[11px] text-primary font-semibold hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
