"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { Package, Search, RefreshCw, AlertTriangle, Building2 } from "lucide-react";

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

interface Sbu {
  id: string;
  name: string;
  code: string;
}

const PRIVILEGED_ROLES = ["ADMIN", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"];

export default function SbuStockPage() {
  const [items, setItems] = useState<SbuStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sbus, setSbus] = useState<Sbu[]>([]);
  const [sbuError, setSbuError] = useState(false);
  const [selectedSbuId, setSelectedSbuId] = useState<string>("");
  const { currency, rate, fmt, toggleCurrency } = useCurrency();

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
  const userRole = () =>
    typeof window !== "undefined" ? (localStorage.getItem("user_role") ?? "") : "";
  const storedSbuId = () =>
    typeof window !== "undefined" ? (localStorage.getItem("user_sbu_id") ?? "") : "";

  const isPrivileged = PRIVILEGED_ROLES.includes(userRole());

  // Privileged roles: fetch all SBUs for the dropdown
  useEffect(() => {
    if (!isPrivileged) return;
    fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((data: Sbu[]) => {
        setSbus(data ?? []);
        // Default to first SBU if none selected yet
        if (!selectedSbuId && data?.length > 0) setSelectedSbuId(data[0].id);
      })
      .catch(() => {
        setSbuError(true);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivileged]);

  async function load(sbuOverride?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const sbuId = sbuOverride ?? selectedSbuId ?? storedSbuId();
      if (sbuId) params.set("sbu_id", sbuId);
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

  // Load stock once selectedSbuId is set (or immediately for non-privileged)
  useEffect(() => {
    if (isPrivileged && !selectedSbuId) return; // wait for SBU list
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSbuId]);

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
            <span>{isPrivileged ? "SBU Overview" : "My SBU"}</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary font-bold">Stock Inventory</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans">
            {isPrivileged ? "SBU Stock" : "My Stock"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {isPrivileged
              ? "Browse stock held by any SBU. Use the selector below to switch between units."
              : "Items currently held by your business unit. Only goods issued to your SBU and not yet returned are shown here."}
          </p>
        </div>

        {/* SBU selector — privileged roles only */}
        {isPrivileged && (
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSbuId}
              onChange={(e) => {
                setSelectedSbuId(e.target.value);
              }}
              className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {sbus.length === 0 && !sbuError && <option value="">Loading SBUs…</option>}
              {sbuError && <option value="">Failed to load SBUs</option>}
              {sbus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        )}

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
                {search ? "No items match your search." : "No stock held by this SBU yet."}
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
                  {isPrivileged && <th className="px-4 py-3 text-left">SBU</th>}
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
                    {isPrivileged && (
                      <td className="px-4 py-3 text-slate-500">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {item.sbu_code}
                        </span>
                      </td>
                    )}
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
