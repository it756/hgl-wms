"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ClipboardList,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  User,
} from "lucide-react";

interface ReturnLineItem {
  id: string;
  product_id: string;
  quantity_to_return: number;
  products: { name: string; sku: string; unit_of_measure: string } | null;
}

interface ReturnRequest {
  id: string;
  reference_number: string;
  status: string;
  reason: string;
  notes: string | null;
  created_at: string;
  raised_by: string;
  transfer_requests: { reference_number: string } | null;
  return_line_items: ReturnLineItem[];
}

export default function ReturnsApprovalPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Per-card approval state
  const [actionId, setActionId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/return-requests?status=PENDING_APPROVAL", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReturns(data ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load pending return requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(id: string, action: "approve" | "reject") {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/return-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          action,
          approval_notes: approvalNotes[id]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setSuccessMsg(
        action === "approve"
          ? `Return approved. The Warehouse Manager has been notified.`
          : `Return rejected. Unit Staff has been notified.`,
      );
      setActionId(null);
      setApprovalNotes((prev) => ({ ...prev, [id]: "" }));
      await load();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || "Action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Header */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>BU Manager</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary">Returns Approval</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
            Returns Approval Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Review return requests raised by unit staff and provide sign-off before the warehouse can receive the goods.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Awaiting Sign-Off
            </span>
            <span className="text-3xl font-extrabold text-amber-600 font-mono">
              {String(returns.length).padStart(2, "0")}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Clearance Level
            </span>
            <span className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> BU Manager
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Next Step After Approval
            </span>
            <span className="text-xs font-bold text-slate-600">
              Warehouse Manager receives goods → stock restored
            </span>
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3.5 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-primary mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Loading pending returns…
            </p>
          </div>
        ) : returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-14 text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-100" />
            <p className="font-extrabold text-slate-700">No Pending Returns</p>
            <p className="text-xs text-slate-400 max-w-xs">
              All return requests from your SBU have been actioned.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {returns.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl p-5 shadow-sm transition-all flex flex-col gap-4"
              >
                {/* Card header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {r.reference_number}
                      </span>
                      <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                        Pending Approval
                      </span>
                    </div>
                    {r.transfer_requests && (
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        From transfer{" "}
                        <span className="font-black text-slate-600 font-mono">
                          {r.transfer_requests.reference_number}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                {/* Reason */}
                <div className="flex gap-2 text-xs">
                  <span className="font-extrabold text-slate-600 shrink-0">Reason:</span>
                  <span className="text-slate-700 font-medium">{r.reason}</span>
                </div>
                {r.notes && (
                  <div className="flex gap-2 text-xs">
                    <span className="font-extrabold text-slate-600 shrink-0">Notes:</span>
                    <span className="text-slate-500 font-medium">{r.notes}</span>
                  </div>
                )}

                {/* Line items */}
                <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
                  {r.return_line_items.map((li) => (
                    <div
                      key={li.id}
                      className="flex items-center justify-between px-4 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">
                          {li.products?.name ?? li.product_id}
                        </span>
                        <span className="text-slate-400 font-mono">{li.products?.sku}</span>
                      </div>
                      <span className="font-extrabold text-slate-800">
                        Qty: {li.quantity_to_return}{" "}
                        <span className="text-slate-400 font-medium">
                          {li.products?.unit_of_measure}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Decision panel */}
                {actionId === r.id ? (
                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                    <textarea
                      rows={2}
                      placeholder="Add approval or rejection notes (optional)…"
                      value={approvalNotes[r.id] ?? ""}
                      onChange={(e) =>
                        setApprovalNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDecision(r.id, "approve")}
                        disabled={submitting}
                        className="flex items-center gap-2 bg-emerald-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Sign & Approve
                      </button>
                      <button
                        onClick={() => handleDecision(r.id, "reject")}
                        disabled={submitting}
                        className="flex items-center gap-2 bg-rose-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-lg hover:bg-rose-700 transition disabled:opacity-60"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => setActionId(null)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 pt-3 flex justify-end">
                    <button
                      onClick={() => setActionId(r.id)}
                      className="flex items-center gap-2 bg-primary text-white font-extrabold text-xs px-5 py-2.5 rounded-lg hover:bg-primary/90 transition"
                    >
                      <ClipboardList className="w-4 h-4" />
                      Review &amp; Decide
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
