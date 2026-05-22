"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import {
  RotateCcw,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  AlertCircle,
} from "lucide-react";

interface ReturnRequest {
  id: string;
  reference_number: string;
  status: string;
  reason: string;
  approval_notes: string | null;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  transfer_requests: { reference_number: string } | null;
  return_line_items: {
    id: string;
    quantity_to_return: number;
    products: { name: string; sku: string } | null;
  }[];
}

function statusConfig(status: string) {
  switch (status) {
    case "PENDING_APPROVAL":
      return {
        label: "Pending Approval",
        className: "bg-amber-50 text-amber-700 border border-amber-200",
        icon: <Clock className="w-3.5 h-3.5" />,
      };
    case "APPROVED":
      return {
        label: "Approved",
        className: "bg-blue-50 text-blue-700 border border-blue-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case "RECEIVED":
      return {
        label: "Received",
        className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-rose-50 text-rose-700 border border-rose-200",
        icon: <XCircle className="w-3.5 h-3.5" />,
      };
    default:
      return {
        label: status,
        className: "bg-slate-100 text-slate-600 border border-slate-200",
        icon: null,
      };
  }
}

export default function MyReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/return-requests", {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setReturns(data ?? []);
      } catch (err: any) {
        setError(err.message || "Failed to load return requests.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Unit Staff</span>
              <span className="text-slate-300">/</span>
              <span className="text-primary">My Returns</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
              Return Requests
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Track goods you have raised for return to the warehouse.
            </p>
          </div>
          <Link
            href="/returns/new"
            className="inline-flex items-center gap-2 bg-primary text-white font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Return
          </Link>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-primary mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Loading return requests…
            </p>
          </div>
        ) : returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-14 text-center flex flex-col items-center gap-3">
            <RotateCcw className="w-10 h-10 text-slate-200" />
            <p className="font-extrabold text-slate-700">No Returns Yet</p>
            <p className="text-xs text-slate-400 max-w-xs">
              You haven't raised any return requests. Use "New Return" to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {returns.map((r) => {
              const sc = statusConfig(r.status);
              return (
                <div
                  key={r.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-3"
                >
                  {/* Title row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {r.reference_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${sc.className}`}
                      >
                        {sc.icon}
                        {sc.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {new Date(r.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Original transfer */}
                  {r.transfer_requests && (
                    <p className="text-xs text-slate-500 font-semibold">
                      Returning from transfer{" "}
                      <span className="font-black text-slate-700 font-mono">
                        {r.transfer_requests.reference_number}
                      </span>
                    </p>
                  )}

                  {/* Reason */}
                  <p className="text-xs text-slate-600 font-medium">
                    <span className="font-extrabold text-slate-700">Reason:</span> {r.reason}
                  </p>

                  {/* Line items summary */}
                  <div className="flex flex-wrap gap-2">
                    {r.return_line_items.map((li) => (
                      <div
                        key={li.id}
                        className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{li.products?.name ?? "Product"}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-black text-slate-800">
                          Qty: {li.quantity_to_return}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Approval/rejection notes */}
                  {r.approval_notes && (
                    <p className="text-xs border-t border-slate-100 pt-2 text-slate-500 font-medium">
                      <span className="font-extrabold text-slate-600">
                        {r.status === "REJECTED" ? "Rejection note:" : "Approval note:"}
                      </span>{" "}
                      {r.approval_notes}
                    </p>
                  )}

                  {/* Received timestamp */}
                  {r.received_at && (
                    <p className="text-xs text-emerald-600 font-semibold border-t border-slate-100 pt-2">
                      ✓ Received at warehouse on{" "}
                      {new Date(r.received_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
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
