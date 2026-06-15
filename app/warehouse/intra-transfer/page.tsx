"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeftRight, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  unit_of_measure: string;
}
interface SBU {
  id: string;
  name: string;
  code: string;
}
interface IntraTransfer {
  id: string;
  reference_number: string;
  product_id: string;
  quantity: number;
  status: string;
  notes: string | null;
  transfer_date: string;
  created_at: string;
  products: Product | null;
  to_sbu: SBU | null;
  from_sbu: SBU | null;
}

export default function IntraTransferPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sbus, setSbus] = useState<SBU[]>([]);
  const [transfers, setTransfers] = useState<IntraTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [toSbuId, setToSbuId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function load() {
    setLoading(true);
    try {
      const [pRes, sRes, tRes] = await Promise.all([
        fetch("/api/admin/products", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/warehouse/intra-transfer", {
          headers: { Authorization: `Bearer ${token()}` },
        }),
      ]);
      const [pData, sData, tData] = await Promise.all([pRes.json(), sRes.json(), tRes.json()]);
      if (pRes.ok) setProducts(pData);
      if (sRes.ok) setSbus(sData);
      if (tRes.ok) setTransfers(tData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!productId || !toSbuId || quantity <= 0) {
      setError("Select a product, target SBU, and quantity > 0");
      return;
    }
    if (selectedProduct && quantity > selectedProduct.stock_quantity) {
      setError(
        `Insufficient stock — only ${selectedProduct.stock_quantity} ${selectedProduct.unit_of_measure} available`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warehouse/intra-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          product_id: productId,
          quantity,
          to_sbu_id: toSbuId,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create transfer");
      setSuccess(
        `Intra-transfer ${data.reference_number} submitted — pending Finance approval`,
      );
      setProductId("");
      setQuantity(0);
      setToSbuId("");
      setNotes("");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-extrabold text-slate-800">Intra-Warehouse Transfers</h1>
        </div>
        <p className="text-xs text-slate-500 max-w-2xl">
          Reassign ownership of warehouse stock to a Strategic Business Unit. Transfers require
          Finance approval before stock is decremented — the receiving SBU is notified once
          approved.
        </p>

        {/* Form */}
        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Search Product
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="">Select a product…</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — {p.stock_quantity} {p.unit_of_measure}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity || ""}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
            {selectedProduct && (
              <p className="text-[10px] text-slate-400 mt-1">
                Available: {selectedProduct.stock_quantity} {selectedProduct.unit_of_measure}
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Target SBU
            </label>
            <select
              value={toSbuId}
              onChange={(e) => setToSbuId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="">Select SBU…</option>
              {sbus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {error && (
            <div className="md:col-span-2 flex items-center gap-2 text-rose-700 text-xs bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && (
            <div className="md:col-span-2 flex items-center gap-2 text-emerald-700 text-xs bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" /> {success}
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Record Intra-Transfer
            </button>
          </div>
        </form>

        {/* Past transfers */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Past Intra-Transfers
            </h2>
            <span className="text-[10px] text-slate-400">{transfers.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2 text-left">Reference</th>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-left">To SBU</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">
                      No intra-transfers yet
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                      <td className="px-4 py-2 font-mono text-primary font-bold">
                        {t.reference_number}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-700">
                          {t.products?.name ?? "—"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {t.products?.sku ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-bold">{t.quantity}</td>
                      <td className="px-4 py-2">{t.to_sbu?.name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                            t.status === "COMPLETED"
                              ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                              : t.status === "PENDING_FINANCE_APPROVAL"
                                ? "bg-amber-50 border border-amber-200 text-amber-700"
                                : "bg-slate-100 border border-slate-200 text-slate-500"
                          }`}
                        >
                          {t.status === "PENDING_FINANCE_APPROVAL"
                            ? "Pending Finance"
                            : t.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
