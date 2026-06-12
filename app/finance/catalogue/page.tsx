"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DamageWriteOffModal from "@/components/DamageWriteOffModal";
import { Layers, Search, Flame } from "lucide-react";

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

export default function FinanceCataloguePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <DashboardLayout>
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-extrabold text-slate-800">Catalogue</h1>
        </div>
        <p className="text-xs text-slate-500 max-w-2xl">
          Read-only view of warehouse stock. Use the Write Off action on any product to record
          damaged inventory directly to the damage ledger.
        </p>

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
