"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  TrendingDown,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  unit_cost: number | null;
}

interface GRNLineItem {
  id: string;
  product_id: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes: string | null;
  products: ProductInfo | null;
}

interface GRNRow {
  id: string;
  has_variance: boolean;
  condition_notes: string | null;
  created_at: string;
  grn_line_items: GRNLineItem[];
}

interface VarianceTransfer {
  id: string;
  reference_number: string;
  sbu_id: string | null;
  created_at: string;
  updated_at: string;
  grns: GRNRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function token() {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminVarianceRegistryPage() {
  const [transfers, setTransfers] = useState<VarianceTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/variance", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
      setTransfers(data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load variance registry");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-slate-800">Variance Registry</h1>
            </div>
            <p className="text-slate-500 text-sm ml-9">
              Read-only audit view of all transfers currently awaiting BU Manager variance
              disposition. BU Managers decide per-line whether to write back stock or record a loss.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Info banner */}
        <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
          <span>
            Transfers marked <strong>COMPLETED_WITH_VARIANCE</strong> are awaiting BU Manager
            disposition. Once all lines are decided, the transfer moves to{" "}
            <strong>COMPLETED</strong>. Write-backs credit warehouse stock; losses are posted to the
            Loss Account.
          </span>
        </div>

        {/* KPI */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
                Pending Disposition
              </p>
              <p className="text-3xl font-bold text-amber-600">{transfers.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
                Total Variance Lines
              </p>
              <p className="text-3xl font-bold text-slate-800">
                {transfers.reduce(
                  (sum, t) =>
                    sum +
                    (t.grns?.[0]?.grn_line_items ?? []).filter(
                      (li) => li.issued_quantity !== li.quantity_received,
                    ).length,
                  0,
                )}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
                SBUs Affected
              </p>
              <p className="text-3xl font-bold text-slate-800">
                {new Set(transfers.map((t) => t.sbu_id)).size}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading variance registry…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && transfers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-400" />
            <p className="font-semibold text-slate-600">No pending variance transfers</p>
            <p className="text-sm mt-1">All variances have been disposed by BU Managers.</p>
          </div>
        )}

        {/* Transfer list */}
        {!loading && !error && transfers.length > 0 && (
          <div className="space-y-4">
            {transfers.map((tr) => {
              const grn = tr.grns?.[0];
              const isOpen = expanded[tr.id] ?? false;
              const varianceLines = (grn?.grn_line_items ?? []).filter(
                (li) => li.issued_quantity !== li.quantity_received,
              );

              return (
                <div
                  key={tr.id}
                  className="bg-white border border-amber-100 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Card header */}
                  <button
                    onClick={() => toggleExpand(tr.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800">{tr.reference_number}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <Building className="w-3 h-3" />
                          {tr.sbu_id ?? "—"}
                          <span className="text-slate-300">·</span>
                          <Clock className="w-3 h-3" />
                          {fmtDate(tr.updated_at)}
                          <span className="text-slate-300">·</span>
                          <span className="font-medium text-amber-600">
                            {varianceLines.length} variance line
                            {varianceLines.length !== 1 ? "s" : ""}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                        Awaiting BU Decision
                      </span>
                      {isOpen ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && grn && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      {grn.condition_notes && (
                        <p className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                          <strong>GRN Condition:</strong> {grn.condition_notes}
                        </p>
                      )}

                      <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                              <th className="px-4 py-3 text-left font-semibold">Product</th>
                              <th className="px-4 py-3 text-center font-semibold">Issued</th>
                              <th className="px-4 py-3 text-center font-semibold">Received</th>
                              <th className="px-4 py-3 text-center font-semibold">Variance</th>
                              <th className="px-4 py-3 text-right font-semibold">Est. Value Gap</th>
                              <th className="px-4 py-3 text-left font-semibold">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {grn.grn_line_items.map((li) => {
                              const delta = li.issued_quantity - li.quantity_received;
                              const valueGap =
                                li.products?.unit_cost != null
                                  ? delta * li.products.unit_cost
                                  : null;

                              return (
                                <tr key={li.id} className={delta !== 0 ? "bg-amber-50/40" : ""}>
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-slate-800">
                                      {li.products?.name ?? "Unknown"}
                                    </p>
                                    <p className="text-xs text-slate-400 font-mono">
                                      {li.products?.sku ?? li.product_id}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-slate-600">
                                    {li.issued_quantity}
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-slate-600">
                                    {li.quantity_received}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {delta === 0 ? (
                                      <span className="text-xs text-slate-400">None</span>
                                    ) : (
                                      <span className="font-bold text-amber-700 text-sm">
                                        -{delta}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm">
                                    {valueGap != null && delta !== 0 ? (
                                      <span className="font-semibold text-rose-600">
                                        ${valueGap.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">
                                    {li.variance_notes ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Disposition legend */}
                      <div className="mt-4 flex gap-6 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                          Write-Back: variance credited back to warehouse stock
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                          Loss: posted to Loss Account with financial value
                        </div>
                      </div>
                    </div>
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
