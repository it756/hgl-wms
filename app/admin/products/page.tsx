"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DamageWriteOffModal from "@/components/DamageWriteOffModal";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Power,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  Activity,
  Building2,
  ArrowLeftRight,
  RefreshCw,
  Flame,
} from "lucide-react";

interface SBU {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  stock_quantity: number;
  low_stock_threshold: number;
  unit_cost: number | null;
  is_active: boolean;
  warehouse_location: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sbus, setSbus] = useState<SBU[]>([]);
  const [sbuFilter, setSbuFilter] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newUom, setNewUom] = useState("unit");
  const [newCost, setNewCost] = useState("");
  const [newThreshold, setNewThreshold] = useState("0");
  const [newLocation, setNewLocation] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Stock adjustment modal
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Direct damage write-off modal
  const [damageProduct, setDamageProduct] = useState<Product | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ active_only: "false" });
      if (search) params.set("search", search);
      if (sbuFilter) params.set("sbu_id", sbuFilter);
      const res = await fetch(`/api/admin/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadSbus() {
      try {
        const res = await fetch("/api/admin/sbus", {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) setSbus(await res.json());
      } catch {
        /* non-critical */
      }
    }
    loadSbus();
    load();
  }, []);

  useEffect(() => {
    load();
  }, [sbuFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: newName,
          sku: newSku,
          unit_of_measure: newUom,
          unit_cost: newCost ? Number(newCost) : undefined,
          low_stock_threshold: Number(newThreshold),
          warehouse_location: newLocation.toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setNewName("");
      setNewSku("");
      setNewUom("unit");
      setNewCost("");
      setNewThreshold("0");
      setNewLocation("");
      load();
    } catch (e: any) {
      setCreateError(e.message);
    }
  }

  async function toggleActive(p: Product) {
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to toggle status");
      }
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustProduct) return;
    setAdjustError(null);
    try {
      const res = await fetch(`/api/admin/products/${adjustProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          adjustment_type: adjustType,
          quantity: Number(adjustQty),
          reason: adjustReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustReason("");
      load();
    } catch (e: any) {
      setAdjustError(e.message);
    }
  }

  const lowStock = (p: Product) => p.stock_quantity <= p.low_stock_threshold;

  // Compute product stats
  const totalQty = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const totalValue = products.reduce((sum, p) => sum + p.stock_quantity * (p.unit_cost || 0), 0);
  const lowStockCount = products.filter(lowStock).length;
  const { currency, rate, fetching: rateFetching, rateError, toggleCurrency, fmt } = useCurrency();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full font-sans">
        {/* Header block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Inventory</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#005c55]">Catalogue</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">
              Corporate Catalogue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Verify stock holdings, regulate low thresholds, and adjust inventory quantities
              directly.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 self-start md:self-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCurrency}
                disabled={rateFetching}
                title={currency === "ZMW" ? "Convert display to USD" : "Switch back to ZMW"}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60"
              >
                {rateFetching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                )}
                {rateFetching
                  ? "Fetching rate…"
                  : currency === "ZMW"
                    ? "View in USD"
                    : "View in ZMW"}
              </button>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="px-4 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add New Product
              </button>
            </div>
            {currency === "USD" && rate != null && (
              <a
                href="https://open.er-api.com/v6/latest/ZMW"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-primary/70 hover:text-primary hover:underline transition-colors"
              >
                1 ZMW = ${rate.toFixed(6)} USD · open.er-api.com
              </a>
            )}
            {rateError && <p className="text-[10px] text-amber-600 font-semibold">{rateError}</p>}
          </div>
        </div>

        {/* KPI Dashboard */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Master SKU count
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-[#1E293B] font-mono">
                {String(products.length).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-[#005c55] bg-[#E6F4F1] border border-teal-150 rounded-full px-1.5 py-0.5 font-bold uppercase">
                Ready
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Total Stock Holdings
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-slate-800 font-mono">
                {totalQty.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                Units
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Shortfall Thresholds
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-extrabold text-amber-600 font-mono">
                {String(lowStockCount).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-amber-700 bg-amber-55/60 border border-amber-100 rounded-full px-1.5 py-0.5 font-bold uppercase">
                Low Stock
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Estimated Value
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-extrabold text-[#0D9488] font-mono">
                {fmt(totalValue)}
              </span>
              <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wide">
                Valued
              </span>
            </div>
          </div>
        </section>

        {/* Create form slide-block */}
        {showCreate && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm mt-6">
            <h3 className="text-sm font-extrabold text-[#1E293B] mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#005c55]" />
              Provision New Product SKU Node
            </h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Product Title
                </label>
                <input
                  required
                  placeholder="e.g. Broken Pekoe 1 Tea (Fancy Grade)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-202 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-805"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Identifier SKU
                </label>
                <input
                  required
                  placeholder="e.g. BP1-KG"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-202 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-850"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Unit of Measure (UoM)
                </label>
                <input
                  placeholder="e.g. kg / bags"
                  value={newUom}
                  onChange={(e) => setNewUom(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-202 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-805"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Unit Cost Default (ZMW)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 230"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-202 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-805"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Low Stock Safety Floor
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-202 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-805"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  Warehouse Location <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. A1, B2, Z1"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value.toUpperCase())}
                  pattern="^[A-Z][12]$"
                  title="One letter A-Z followed by 1 or 2 (e.g. A1, B2)"
                  maxLength={2}
                  className="w-full px-3.5 py-2 border border-slate-202 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-805 uppercase"
                />
              </div>
              {createError && (
                <p className="text-rose-600 text-xs font-semibold font-mono uppercase mt-1 md:col-span-3">
                  {createError}
                </p>
              )}
              <div className="md:col-span-3 flex justify-end gap-2 border-t border-slate-100 pt-4 mt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Commit SKU
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Listing Block */}
        <div className="bg-white border border-slate-200/95 rounded-xl shadow-sm flex flex-col overflow-hidden mt-6">
          {/* Action header bar */}
          <div className="p-4 border-b border-slate-100/50 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by title or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  className="w-56 pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-800"
                />
              </div>
              {sbus.length > 0 && (
                <div className="relative flex items-center gap-1.5">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={sbuFilter}
                    onChange={(e) => setSbuFilter(e.target.value)}
                    className="pl-8 pr-6 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="">All SBUs</option>
                    {sbus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={load}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg cursor-pointer transition-all"
              >
                Search
              </button>
              {sbuFilter && (
                <button
                  onClick={() => {
                    setSbuFilter("");
                  }}
                  className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold rounded-lg cursor-pointer transition-all"
                >
                  Clear SBU
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold font-mono">
              <Activity className="w-3.5 h-3.5 text-[#005c55]" />
              {sbuFilter ? (
                <span>
                  {sbus.find((s) => s.id === sbuFilter)?.code ?? "SBU"} —{" "}
                  {products.filter((p) => p.is_active).length} ACTIVE SKUs
                </span>
              ) : (
                <span>ACTIVE SKUs: {products.filter((p) => p.is_active).length}</span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#005c55]"></span>
              <p className="text-xs font-bold font-mono">RETRIEVING PRODUCT REGISTER...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-semibold text-xs font-mono uppercase">
              {sbuFilter
                ? `No products found for ${sbus.find((s) => s.id === sbuFilter)?.name ?? "this SBU"}.`
                : "No matching products found in register."}
            </div>
          ) : (
            <div className="overflow-x-auto text-[#1E293B]">
              <table className="min-w-full divide-y divide-slate-100 text-xs font-medium">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                    <th className="px-6 py-4 text-left w-[12%]">SKU</th>
                    <th className="px-6 py-4 text-left w-[28%]">Product Specification Name</th>
                    <th className="px-6 py-4 text-left w-[8%]">Location</th>
                    <th className="px-6 py-4 text-left w-[8%]">UOM</th>
                    <th className="px-6 py-4 text-left w-[8%]">Stock Qty</th>
                    <th className="px-6 py-4 text-left w-[8%]">Low Safe Limit</th>
                    <th className="px-6 py-4 text-left w-[8%]">Unit Cost</th>
                    <th className="px-6 py-4 text-left w-[10%]">State</th>
                    <th className="px-6 py-4 text-right w-[10%]">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {products.map((p) => {
                    const isLow = lowStock(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-slate-705 font-bold">{p.sku}</td>
                        <td className="px-6 py-3.5">
                          <span className="font-extrabold text-slate-800 text-sm block">
                            {p.name}
                          </span>
                          {isLow && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase mt-0.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Restock urgent
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center justify-center w-9 h-6 rounded font-mono font-extrabold text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 tracking-wider">
                            {p.warehouse_location || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 font-bold uppercase">
                          {p.unit_of_measure}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`text-base font-extrabold font-mono ${isLow ? "text-amber-500 font-bold" : "text-slate-800"}`}
                          >
                            {p.stock_quantity.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-500 font-semibold">
                          {p.low_stock_threshold}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[#0D9488] font-bold">
                          {fmt(p.unit_cost)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              p.is_active
                                ? "bg-teal-50 border border-teal-200 text-teal-800"
                                : "bg-slate-100 border border-slate-200 text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${p.is_active ? "bg-teal-600" : "bg-slate-400"}`}
                            ></span>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => {
                                setAdjustProduct(p);
                                setAdjustType("add");
                                setAdjustQty("");
                                setAdjustReason("");
                                setAdjustError(null);
                              }}
                              className="px-2.5 py-1 bg-[#E6F4F1] border border-[#BCE3DE] hover:bg-[#D5EFEA] text-[#005c55] font-bold rounded-lg transition-all text-[11px] cursor-pointer"
                            >
                              Adjust Stock
                            </button>
                            <button
                              onClick={() => setDamageProduct(p)}
                              disabled={p.stock_quantity <= 0}
                              className="px-2.5 py-1 bg-rose-50 border border-rose-100 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 font-bold rounded-lg text-[11px] inline-flex items-center gap-1"
                            >
                              <Flame className="w-3 h-3" /> Write Off
                            </button>
                            <button
                              onClick={() => toggleActive(p)}
                              className={`p-1 px-2 border rounded-md transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
                                p.is_active
                                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                                  : "bg-teal-50 border-teal-200 text-[#005c55] hover:bg-teal-100"
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              {p.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Stock adjustment modal */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={submitAdjust}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md border border-slate-150 flex flex-col gap-4"
          >
            <div>
              <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <span>Catalogue Manager</span>
                <span>/</span>
                <span>Adjustment</span>
              </div>
              <h2 className="font-extrabold text-[#1E293B] text-lg">Adjust Live Balances</h2>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                SKU Node:{" "}
                <strong className="text-slate-800 font-mono text-[13px]">
                  {adjustProduct.name} ({adjustProduct.sku})
                </strong>
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">
                Current Recorded Level:
              </span>
              <span className="font-mono text-base font-extrabold text-slate-800">
                {adjustProduct.stock_quantity.toLocaleString()} {adjustProduct.unit_of_measure}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                Adjustment Vector
              </span>
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => setAdjustType("add")}
                  className={`py-2 px-4 border rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    adjustType === "add"
                      ? "bg-teal-50 border-[#0D9488] text-[#0D9488]"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" /> Increment (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("remove")}
                  className={`py-2 px-4 border rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    adjustType === "remove"
                      ? "bg-rose-50 border-rose-500 text-rose-700"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" /> Decrement (-)
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                Adjustment Stock Quantity
              </label>
              <input
                required
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-semibold text-slate-805"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                Mandatory Auditable Reason
              </label>
              <input
                required
                placeholder="e.g. Annual stocktake discrepancy audit"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] font-medium text-slate-805"
              />
            </div>

            {adjustError && (
              <p className="text-rose-600 font-semibold font-mono uppercase text-[10px]">
                {adjustError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-1">
              <button
                type="button"
                onClick={() => setAdjustProduct(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm"
              >
                Confirm Adjust
              </button>
            </div>
          </form>
        </div>
      )}

      {damageProduct && (
        <DamageWriteOffModal
          product={damageProduct}
          onClose={() => setDamageProduct(null)}
          onSuccess={load}
        />
      )}
    </DashboardLayout>
  );
}
