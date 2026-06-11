"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { TrendingDown, Package, Building, Loader2, AlertTriangle, Search, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LossRecord {
  id: string;
  reference_number: string;
  quantity_lost: number;
  unit_cost_at_loss: number | null;
  value_lost: number | null;
  decided_at: string;
  reason_notes: string | null;
  created_at: string;
  product_id: string;
  sbu_id: string;
  transfer_request_id: string;
  products: { id: string; name: string; sku: string; unit_of_measure: string } | null;
  sbus: { id: string; name: string; code: string } | null;
  transfer_requests: { id: string; reference_number: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dp = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LossAccountPage() {
  const [losses, setLosses] = useState<LossRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouse/losses", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
      setLosses(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load loss account");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // KPIs
  const totalQtyLost = useMemo(() => losses.reduce((sum, l) => sum + l.quantity_lost, 0), [losses]);
  const totalValueLost = useMemo(
    () => losses.reduce((sum, l) => sum + (l.value_lost ?? 0), 0),
    [losses],
  );
  const totalWithValue = useMemo(() => losses.filter((l) => l.value_lost != null).length, [losses]);

  // Filtered rows
  const filtered = useMemo(() => {
    if (!search.trim()) return losses;
    const q = search.toLowerCase();
    return losses.filter(
      (l) =>
        l.reference_number.toLowerCase().includes(q) ||
        l.products?.name.toLowerCase().includes(q) ||
        l.products?.sku.toLowerCase().includes(q) ||
        l.sbus?.name.toLowerCase().includes(q) ||
        l.transfer_requests?.reference_number.toLowerCase().includes(q),
    );
  }, [losses, search]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <TrendingDown className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold text-slate-800">Loss Account</h1>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            Stock items written off as losses following BU Manager variance disposition decisions.
          </p>
        </div>

        {/* KPI Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Total Loss Entries
              </p>
              <p className="text-3xl font-bold text-slate-800">{losses.length}</p>
              <p className="text-xs text-slate-400 mt-1">across all SBUs and transfers</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Total Units Lost
              </p>
              <p className="text-3xl font-bold text-rose-600">{totalQtyLost.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">sum of all quantity_lost values</p>
            </div>
            <div className="border border-rose-100 rounded-xl p-5 shadow-sm bg-rose-50">
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide mb-1">
                Total Value Lost
              </p>
              <p className="text-3xl font-bold text-rose-700">${fmt(totalValueLost)}</p>
              <p className="text-xs text-rose-400 mt-1">
                {totalWithValue} of {losses.length} entries have costed value
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        {!loading && !error && losses.length > 0 && (
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product, SKU, SBU, reference…"
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading loss account…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && losses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Package className="w-12 h-12 mb-4 text-slate-300" />
            <p className="font-semibold text-slate-600">No losses recorded</p>
            <p className="text-sm mt-1">
              Loss entries appear here when a BU Manager marks a variance as a loss.
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Loss Ref</th>
                    <th className="px-4 py-3 text-left font-semibold">Product</th>
                    <th className="px-4 py-3 text-left font-semibold">SBU</th>
                    <th className="px-4 py-3 text-left font-semibold">Transfer</th>
                    <th className="px-4 py-3 text-right font-semibold">Qty Lost</th>
                    <th className="px-4 py-3 text-right font-semibold">Unit Cost</th>
                    <th className="px-4 py-3 text-right font-semibold">Value Lost</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((loss) => (
                    <tr key={loss.id} className="hover:bg-slate-50 transition-colors">
                      {/* Loss reference */}
                      <td className="px-4 py-3 font-mono text-xs text-rose-600 font-semibold whitespace-nowrap">
                        {loss.reference_number}
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 leading-tight">
                          {loss.products?.name ?? "Unknown product"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {loss.products?.sku} · {loss.products?.unit_of_measure}
                        </p>
                      </td>

                      {/* SBU */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-700">{loss.sbus?.name ?? loss.sbu_id}</span>
                        </div>
                      </td>

                      {/* Transfer reference */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {loss.transfer_requests?.reference_number ?? "—"}
                      </td>

                      {/* Qty lost */}
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        {loss.quantity_lost}
                      </td>

                      {/* Unit cost */}
                      <td className="px-4 py-3 text-right text-slate-600">
                        {loss.unit_cost_at_loss != null ? (
                          `$${fmt(loss.unit_cost_at_loss, 4)}`
                        ) : (
                          <span className="text-slate-400 text-xs">no cost</span>
                        )}
                      </td>

                      {/* Value lost */}
                      <td className="px-4 py-3 text-right">
                        {loss.value_lost != null ? (
                          <span className="font-bold text-rose-700">${fmt(loss.value_lost)}</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {fmtDate(loss.decided_at)}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-45">
                        {loss.reason_notes ? (
                          <span className="block truncate" title={loss.reason_notes}>
                            {loss.reason_notes}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer totals */}
                {filtered.length > 1 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500"
                      >
                        {filtered.length} entries
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600">
                        {filtered.reduce((s, l) => s + l.quantity_lost, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right text-rose-700">
                        ${fmt(filtered.reduce((s, l) => s + (l.value_lost ?? 0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* No results from search */}
        {!loading && !error && losses.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            No losses match &quot;{search}&quot;
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
