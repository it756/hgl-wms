"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { Package, Search, RefreshCw, AlertTriangle } from "lucide-react";

interface SbuStockItem {
  sbu_id: string;
  product_id: string;
  quantity: number;
  product_name: string;
  sku: string;
  unit_of_measure: string;
  unit_cost: number | null;
  is_active: boolean;
  sbu_name: string;
  sbu_code: string;
}

export default function SbuStockPage() {
  const [items, setItems] = useState<SbuStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { currency, rate, fmt, toggleCurrency } = useCurrency();

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/bu/stock?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load stock");
      setItems(data as SbuStockItem[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.product_name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalValue = useMemo(
    () =>
      filtered.reduce((sum, i) => sum + (i.unit_cost ?? 0) * i.quantity, 0),
    [filtered],
  );

  return (
    <DashboardLayout>
      <div className="px-6 py-6 space-y-6 w-full">
        {/* Header */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>My SBU</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary font-bold">Stock Inventory</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans">
            My Stock
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Items currently held by your business unit. Only goods issued to
            your SBU and not yet returned are shown here.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            />
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={toggleCurrency}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 transition"
          >
            {currency === "ZMW" ? "Switch to USD" : "Switch to ZMW"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-2.5 rounded-lg text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Summary card */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total SKUs
              </p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">
                {filtered.length}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Units
              </p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">
                {filtered.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Estimated Value
              </p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">
                {fmt(totalValue)}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Package className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">
                {search ? "No items match your search." : "No stock held by your SBU yet."}
              </p>
              {!search && (
                <p className="text-xs text-slate-400 max-w-xs text-center">
                  Stock appears here once the warehouse issues goods to your
                  unit via an approved transfer request.
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">UoM</th>
                  <th className="px-4 py-3 text-right">Qty Held</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr
                    key={`${item.sbu_id}-${item.product_id}`}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.product_name}
                      {!item.is_active && (
                        <span className="ml-2 text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{item.sku}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      <span
                        className={
                          item.quantity <= 5
                            ? "text-rose-600"
                            : item.quantity <= 20
                              ? "text-amber-600"
                              : "text-emerald-700"
                        }
                      >
                        {item.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {item.unit_cost != null ? fmt(item.unit_cost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {item.unit_cost != null
                        ? fmt(item.unit_cost * item.quantity)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
