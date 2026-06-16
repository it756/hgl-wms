"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DamageWriteOffModal from "@/components/DamageWriteOffModal";
import { Layers, Search, Flame, Plus, CheckCircle, Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  unit_of_measure: string;
  unit_cost: number | null;
  warehouse_id?: string | null;
  is_active: boolean;
}

interface Sbu {
  id: string;
  name: string;
  code: string;
}

export default function FinanceCataloguePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SBU list
  const [sbus, setSbus] = useState<Sbu[]>([]);

  // Create product form
  const [showCreate, setShowCreate] = useState(false);
  const [cpName, setCpName] = useState("");
  const [cpSku, setCpSku] = useState("");
  const [cpUom, setCpUom] = useState("unit");
  const [cpCost, setCpCost] = useState("");
  const [cpThreshold, setCpThreshold] = useState("0");
  const [cpLocation, setCpLocation] = useState("");
  const [cpInitialQty, setCpInitialQty] = useState("0");
  const [cpSbuId, setCpSbuId] = useState("");
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSubmitting, setCpSubmitting] = useState(false);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setProducts((data as Product[]).filter((p) => p.is_active !== false));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Fetch SBUs for the create-product form
    fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((data: Sbu[]) => {
        setSbus(data ?? []);
        if (data?.length > 0) setCpSbuId(data[0].id);
      })
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

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
          sbu_id: cpSbuId,
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
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-extrabold text-slate-800">Catalogue</h1>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
        <p className="text-xs text-slate-500 max-w-2xl">
          View warehouse stock, write off damaged inventory, or add new products to an SBU.
        </p>

        {/* Create product form */}
        {showCreate && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#1E293B] mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#005c55]" />
              Add New Product
            </h3>
            <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  SBU <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={cpSbuId}
                  onChange={(e) => setCpSbuId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55]"
                >
                  <option value="">Select SBU…</option>
                  {sbus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
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
                <p className="text-[10px] text-slate-400">Auto-prefixed with the SBU code</p>
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

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 px-3 py-2 rounded-lg text-xs">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2 text-right">Unit Cost</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    No products
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                    <td className="px-4 py-2 font-semibold text-slate-700">{p.name}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{p.sku}</td>
                    <td className="px-4 py-2 text-right font-bold">
                      {p.stock_quantity} {p.unit_of_measure}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.unit_cost != null ? `ZMW ${Number(p.unit_cost).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setActive(p)}
                        disabled={p.stock_quantity <= 0}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 border border-rose-100 text-[11px] font-bold rounded-lg inline-flex items-center gap-1"
                      >
                        <Flame className="w-3 h-3" /> Write Off
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <DamageWriteOffModal product={active} onClose={() => setActive(null)} onSuccess={load} />
      )}
    </DashboardLayout>
  );
}
