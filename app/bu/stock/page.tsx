"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  Package,
  Search,
  RefreshCw,
  AlertTriangle,
  Building2,
  Plus,
  CheckCircle,
} from "lucide-react";

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

  // Create product form
  const [showCreate, setShowCreate] = useState(false);
  const [cpName, setCpName] = useState("");
  const [cpSku, setCpSku] = useState("");
  const [cpUom, setCpUom] = useState("unit");
  const [cpCost, setCpCost] = useState("");
  const [cpThreshold, setCpThreshold] = useState("0");
  const [cpLocation, setCpLocation] = useState("");
  const [cpInitialQty, setCpInitialQty] = useState("0");
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSubmitting, setCpSubmitting] = useState(false);

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
      (i) => i.product_name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, i) => sum + (i.unit_cost ?? 0) * i.quantity, 0),
    [filtered],
  );

  const isBuManager = userRole() === "BU_MANAGER";

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setCpError(null);
    setCpSubmitting(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: cpName,
          sku: cpSku,
          unit_of_measure: cpUom,
          unit_cost: cpCost ? Number(cpCost) : undefined,
          low_stock_threshold: Number(cpThreshold),
          warehouse_location: cpLocation.toUpperCase(),
          initial_quantity: Number(cpInitialQty),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setCpName("");
      setCpSku("");
      setCpUom("unit");
      setCpCost("");
      setCpThreshold("0");
      setCpLocation("");
      setCpInitialQty("0");
      load();
    } catch (err: any) {
      setCpError(err.message);
    } finally {
      setCpSubmitting(false);
    }
  }

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
          {isBuManager && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add New Product
            </button>
          )}
        </div>

        {/* Create product form — BU Manager only */}
        {isBuManager && showCreate && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#1E293B] mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#005c55]" />
              Add New Product to Your SBU
            </h3>
            <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. Broken Pekoe 1 Tea"
                  value={cpName}
                  onChange={(e) => setCpName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  SKU <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. BP1-KG"
                  value={cpSku}
                  onChange={(e) => setCpSku(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
                <p className="text-[10px] text-slate-400">
                  Auto-prefixed with your SBU code (e.g. LBMB-BP1-KG)
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Unit of Measure
                </label>
                <input
                  placeholder="e.g. kg / bags"
                  value={cpUom}
                  onChange={(e) => setCpUom(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Unit Cost (ZMW)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="e.g. 230"
                  value={cpCost}
                  onChange={(e) => setCpCost(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 50"
                  value={cpThreshold}
                  onChange={(e) => setCpThreshold(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Initial Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 100"
                  value={cpInitialQty}
                  onChange={(e) => setCpInitialQty(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Warehouse Location <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. A1, B2"
                  value={cpLocation}
                  onChange={(e) => setCpLocation(e.target.value.toUpperCase())}
                  pattern="^[A-Z][12]$"
                  title="One letter A-Z followed by 1 or 2 (e.g. A1, B2)"
                  maxLength={2}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] uppercase"
                />
              </div>
              {cpError && (
                <p className="text-rose-600 text-xs font-semibold md:col-span-3">{cpError}</p>
              )}
              <div className="md:col-span-3 flex justify-end gap-2 border-t border-slate-100 pt-4 mt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cpSubmitting}
                  className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {cpSubmitting ? "Saving…" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        )}

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
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{filtered.length}</p>
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
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{fmt(totalValue)}</p>
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
                  Stock appears here once the warehouse issues goods to your unit via an approved
                  transfer request.
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
                      {item.unit_cost != null ? fmt(item.unit_cost * item.quantity) : "—"}
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
