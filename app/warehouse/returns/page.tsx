"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  PackageCheck,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Building,
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
  approval_notes: string | null;
  sbu_id: string;
  created_at: string;
  approved_at: string | null;
  transfer_requests: { reference_number: string } | null;
  return_line_items: ReturnLineItem[];
}

export default function WarehouseReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/return-requests?status=APPROVED", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReturns(data ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load approved returns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmReceipt(id: string, ref: string) {
    setReceiving(id);
    setError(null);
    try {
      const res = await fetch(`/api/return-requests/${id}/receive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Receipt confirmation failed");
      setSuccessMsg(`Return ${ref} confirmed. Stock has been restored to the warehouse.`);
      setReturns((prev) => prev.filter((r) => r.id !== id));
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setError(err.message || "Receipt confirmation failed. Please try again.");
    } finally {
      setReceiving(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Header */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Warehouse</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary">Incoming Returns</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
            Returns Incoming
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            BU Manager–approved returns awaiting physical receipt. Confirm receipt to restore stock
            to the warehouse.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Awaiting Receipt
            </span>
            <span className="text-3xl font-extrabold text-blue-600 font-mono">
              {String(returns.length).padStart(2, "0")}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              On Confirm
            </span>
            <span className="text-xs font-bold text-slate-700">
              Stock quantities incremented automatically
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Clearance
            </span>
            <span className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Warehouse Manager
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
              Loading approved returns…
            </p>
          </div>
        ) : returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-14 text-center flex flex-col items-center gap-3">
            <RotateCcw className="w-10 h-10 text-slate-200" />
            <p className="font-extrabold text-slate-700">No Returns Awaiting Receipt</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Approved return requests from SBUs will appear here for physical confirmation.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {returns.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm transition-all flex flex-col gap-4"
              >
                {/* Card header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {r.reference_number}
                      </span>
                      <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                        Approved — Awaiting Receipt
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
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 font-semibold">
                    <div className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      <span className="font-bold text-slate-600">{r.sbu_id}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {r.approved_at
                        ? new Date(r.approved_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="flex gap-2 text-xs">
                  <span className="font-extrabold text-slate-600 shrink-0">Reason:</span>
                  <span className="text-slate-700 font-medium">{r.reason}</span>
                </div>
                {r.approval_notes && (
                  <div className="flex gap-2 text-xs">
                    <span className="font-extrabold text-slate-600 shrink-0">Approval note:</span>
                    <span className="text-slate-500 font-medium">{r.approval_notes}</span>
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
                        <span className="text-slate-400 font-mono text-[10px]">
                          {li.products?.sku}
                        </span>
                      </div>
                      <span className="font-extrabold text-slate-800">
                        {li.quantity_to_return}{" "}
                        <span className="text-slate-400 font-medium text-[10px]">
                          {li.products?.unit_of_measure}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Confirm receipt */}
                <div className="border-t border-slate-100 pt-3 flex justify-end">
                  <button
                    onClick={() => confirmReceipt(r.id, r.reference_number)}
                    disabled={receiving === r.id}
                    className="flex items-center gap-2 bg-emerald-600 text-white font-extrabold text-xs px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {receiving === r.id ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                        Confirming…
                      </>
                    ) : (
                      <>
                        <PackageCheck className="w-4 h-4" />
                        Confirm Receipt &amp; Restore Stock
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
