"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertTriangle, Search, Loader2 } from "lucide-react";

interface ExpiryRow {
  id: string;
  reference_number: string;
  product_id: string;
  quantity_expired: number;
  expiry_date: string | null;
  unit_cost_at_expiry: number | null;
  value_expired: number | null;
  currency: string;
  notes: string | null;
  expired_at: string;
  expired_by_name: string | null;
  products: { id: string; name: string; sku: string; unit_of_measure: string } | null;
}

export default function ExpiryLedgerPage() {
  const [rows, setRows] = useState<ExpiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const url = `/api/admin/expiry-ledger${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.products?.name ?? "").toLowerCase().includes(q) ||
        (r.products?.sku ?? "").toLowerCase().includes(q) ||
        r.reference_number.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalValue = filtered.reduce((s, r) => s + Number(r.value_expired ?? 0), 0);
  const totalQty = filtered.reduce((s, r) => s + Number(r.quantity_expired ?? 0), 0);

  return (
    <DashboardLayout>
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <h1 className="text-xl font-extrabold text-slate-800">Expiry Ledger</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Entries
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{filtered.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Units Expired
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{totalQty}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Value Lost
            </div>
            <div className="text-2xl font-extrabold text-rose-700 mt-1">
              ZMW {totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Search
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product, SKU, or reference…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div className="md:col-span-4">
            <button
              onClick={load}
              className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 px-3 py-2 rounded-lg text-xs">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-left">Expiry Date</th>
                <th className="px-4 py-2 text-right">Unit Cost</th>
                <th className="px-4 py-2 text-right">Value Lost</th>
                <th className="px-4 py-2 text-left">Recorded By</th>
                <th className="px-4 py-2 text-left">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400">
                    <Loader2 className="w-4 h-4 inline animate-spin" /> Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400">
                    No expiry entries
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                    <td className="px-4 py-2 font-mono font-bold text-primary">
                      {r.reference_number}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-slate-700">{r.products?.name ?? "—"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.products?.sku ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-bold">{r.quantity_expired}</td>
                    <td className="px-4 py-2">{r.expiry_date ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {r.unit_cost_at_expiry != null
                        ? `${r.currency} ${Number(r.unit_cost_at_expiry).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-rose-700">
                      {r.value_expired != null
                        ? `${r.currency} ${Number(r.value_expired).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">{r.expired_by_name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(r.expired_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
