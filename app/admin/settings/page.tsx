"use client";

import { useEffect, useState } from "react";

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

  const token = () => localStorage.getItem("access_token") ?? "";

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

  if (loading)
    return (
      <main className="p-6">
        <p className="text-gray-500 text-sm">Loading…</p>
      </main>
    );

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">System Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Finance Approvals */}
      <section className="bg-white border rounded p-5 shadow-sm">
        <h2 className="font-semibold mb-4 text-gray-800">Finance Approvals</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Approval Threshold (KES)</label>
            <input
              type="number"
              value={settings.finance_approval_threshold ?? ""}
              onChange={(e) =>
                setSettings((s) => ({ ...s, finance_approval_threshold: e.target.value }))
              }
              className="border rounded px-3 py-2 text-sm w-48"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Approval Scope</label>
            <div className="flex gap-4">
              {["global", "per_sbu"].map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.finance_approval_scope === v}
                    onChange={() => setSettings((s) => ({ ...s, finance_approval_scope: v }))}
                  />
                  {v === "global" ? "Global" : "Per SBU"}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() =>
              save("finance", {
                finance_approval_threshold: settings.finance_approval_threshold,
                finance_approval_scope: settings.finance_approval_scope,
              })
            }
            disabled={saving === "finance"}
            className="bg-teal-700 text-white rounded px-4 py-2 text-sm disabled:opacity-50 hover:bg-teal-800"
          >
            {saving === "finance" ? "Saving…" : "Save"}
          </button>
          {saved === "finance" && <span className="text-green-600 text-sm">Saved ✓</span>}
        </div>
      </section>

      {/* Session */}
      <section className="bg-white border rounded p-5 shadow-sm">
        <h2 className="font-semibold mb-4 text-gray-800">Session</h2>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Session Timeout (minutes)</label>
          <input
            type="number"
            value={settings.session_timeout_minutes ?? ""}
            onChange={(e) =>
              setSettings((s) => ({ ...s, session_timeout_minutes: e.target.value }))
            }
            className="border rounded px-3 py-2 text-sm w-32"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() =>
              save("session", { session_timeout_minutes: settings.session_timeout_minutes })
            }
            disabled={saving === "session"}
            className="bg-teal-700 text-white rounded px-4 py-2 text-sm disabled:opacity-50 hover:bg-teal-800"
          >
            {saving === "session" ? "Saving…" : "Save"}
          </button>
          {saved === "session" && <span className="text-green-600 text-sm">Saved ✓</span>}
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white border rounded p-5 shadow-sm">
        <h2 className="font-semibold mb-4 text-gray-800">Notifications</h2>
        <div className="space-y-3">
          {[
            { key: "low_stock_alert_enabled" as keyof Settings, label: "Low Stock Alerts" },
            { key: "email_notifications_enabled" as keyof Settings, label: "Email Notifications" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() =>
                  setSettings((s) => ({ ...s, [key]: s[key] === "true" ? "false" : "true" }))
                }
                className={`relative w-10 h-5 rounded-full transition-colors ${settings[key] === "true" ? "bg-teal-600" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[key] === "true" ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() =>
              save("notifications", {
                low_stock_alert_enabled: settings.low_stock_alert_enabled,
                email_notifications_enabled: settings.email_notifications_enabled,
              })
            }
            disabled={saving === "notifications"}
            className="bg-teal-700 text-white rounded px-4 py-2 text-sm disabled:opacity-50 hover:bg-teal-800"
          >
            {saving === "notifications" ? "Saving…" : "Save"}
          </button>
          {saved === "notifications" && <span className="text-green-600 text-sm">Saved ✓</span>}
        </div>
      </section>
    </main>
  );
}
