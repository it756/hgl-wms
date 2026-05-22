"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Sliders, 
  Coins, 
  Clock, 
  Bell, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Mail,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

interface Settings {
  finance_approval_threshold: string;
  finance_approval_scope: string;
  session_timeout_minutes: string;
  low_stock_alert_enabled: string;
  email_notifications_enabled: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(section: string, payload: Partial<Settings>) {
    setSaving(section);
    setSaved(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(section);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <DashboardLayout activePage="/admin/settings">
      <div className="flex flex-col gap-6 w-full text-slate-850 font-sans">
        
        {/* Header Block */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Administration</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary font-extrabold">System Settings</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">System Configuration</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Manage financial threshold gates, configure automated worker alerts, and set default compliance limits.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Error: {error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="animate-spin rounded-full h-8 w-8 text-primary" />
            <p className="text-xs font-bold font-mono tracking-wider">LOADING ENVIRONMENT CONSTANTS...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Column 1 & 2: Main Settings Panel */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Finance Approvals Section */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-slate-50 rounded-lg text-primary">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#1E293B]">Finance Control Gates</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Configure thresholds that trigger mandatory higher execution signs.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-1 max-w-sm">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Approval Cut-off Threshold (ZMW)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">ZMW</span>
                      <input
                        type="number"
                        value={settings.finance_approval_threshold ?? ""}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, finance_approval_threshold: e.target.value }))
                        }
                        className="w-full pl-12 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Enforcement Scope</label>
                    <div className="flex gap-4">
                      {["global", "per_sbu"].map((v) => (
                        <label key={v} className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-100/70 transition-all select-none col-span-1">
                          <input
                            type="radio"
                            checked={settings.finance_approval_scope === v}
                            onChange={() => setSettings((s) => ({ ...s, finance_approval_scope: v }))}
                            className="text-primary focus:ring-primary h-3.5 w-3.5 border-slate-300"
                          />
                          <span>{v === "global" ? "Global Account Audit" : "Distinct SBU Audits"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() =>
                      save("finance", {
                        finance_approval_threshold: settings.finance_approval_threshold,
                        finance_approval_scope: settings.finance_approval_scope,
                      })
                    }
                    disabled={saving === "finance"}
                    className="px-4 py-2 bg-primary hover:bg-[#004740] disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
                  >
                    {saving === "finance" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Save Parameters</span>
                    )}
                  </button>
                  {saved === "finance" && (
                    <span className="text-teal-650 font-bold text-[10px] uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Parameters Live
                    </span>
                  )}
                </div>
              </section>

              {/* Session Controls Section */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-slate-50 rounded-lg text-[#0F172A]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#1E293B]">Session Governance</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Automatic idle expiration timers to enforce physical security.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-w-sm">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Token Validity Limit (Minutes)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.session_timeout_minutes ?? ""}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, session_timeout_minutes: e.target.value }))
                      }
                      className="w-full pr-16 pl-4 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase font-sans">Min</span>
                  </div>
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() =>
                      save("session", { session_timeout_minutes: settings.session_timeout_minutes })
                    }
                    disabled={saving === "session"}
                    className="px-4 py-2 bg-primary hover:bg-[#004740] disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
                  >
                    {saving === "session" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Save Expiration</span>
                    )}
                  </button>
                  {saved === "session" && (
                    <span className="text-teal-650 font-bold text-[10px] uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Threshold Live
                    </span>
                  )}
                </div>
              </section>

              {/* Automated Worker Alerts Section */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-slate-50 rounded-lg text-primary">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#1E293B]">Automated Worker Notifications</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Toggle background message triggers across communication pipelines.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { key: "low_stock_alert_enabled" as keyof Settings, label: "Immediate SKU shortfalls warnings", desc: "Triggers notifications to procurement supervisors on warehouse checkout limits." },
                    { key: "email_notifications_enabled" as keyof Settings, label: "Compliance Transaction Dispatch Receipts", desc: "Dispatches verification emails to SBU officers and finance controllers instantly." },
                  ].map(({ key, label, desc }) => (
                    <div 
                      key={key} 
                      onClick={() =>
                        setSettings((s) => ({ ...s, [key]: s[key] === "true" ? "false" : "true" }))
                      }
                      className="flex items-start gap-4 p-3 bg-slate-50 hover:bg-slate-100/40 rounded-xl border border-slate-200/60 cursor-pointer transition-all select-none"
                    >
                      <button type="button" className="text-primary mt-1 shrink-0">
                        {settings[key] === "true" ? (
                          <ToggleRight className="w-10 h-6 text-primary" />
                        ) : (
                          <ToggleLeft className="w-10 h-6 text-slate-300" />
                        )}
                      </button>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#1E293B]">{label}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() =>
                      save("notifications", {
                        low_stock_alert_enabled: settings.low_stock_alert_enabled,
                        email_notifications_enabled: settings.email_notifications_enabled,
                      })
                    }
                    disabled={saving === "notifications"}
                    className="px-4 py-2 bg-primary hover:bg-[#004740] disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
                  >
                    {saving === "notifications" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Save Pipeline Active State</span>
                    )}
                  </button>
                  {saved === "notifications" && (
                    <span className="text-teal-650 font-bold text-[10px] uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Toggle Captured
                    </span>
                  )}
                </div>
              </section>

            </div>

            {/* Column 3: Summary Sidebar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Compliance Checklist
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Changing rules modifies environment behaviors. Make sure to consult the corporate WMS standard operating procedure prior to updating parameters.
              </p>
              
              <div className="border-t border-slate-200 pt-4 flex flex-col gap-2.5 text-[11px] font-medium text-slate-700">
                <span className="flex items-center gap-1.5 text-emerald-700 font-bold uppercase tracking-wider text-[9px] bg-emerald-50 px-2 py-1 rounded">
                  ✓ Active configuration validated
                </span>
                <p className="mt-1 leading-relaxed text-slate-500 font-semibold">
                  Any settings modification results in a high-priority audit vector trace generated inside the secure system ledger instantly.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
