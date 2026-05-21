"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Trash, CheckCircle2, ChevronRight, HelpCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface LineItem {
  product_id: string;
  requested_quantity: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  uom: string;
}

export default function NewTransferRequestPage() {
  const router = useRouter();
  const [sbuId, setSbuId] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ product_id: "", requested_quantity: 1 }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Attempt to prefetch products list from backend for beautiful dropdown
    async function loadProducts() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/admin/products", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProducts(data || []);
        }
      } catch (err) {
        console.error("Products catalogue prefetch failed", err);
      }
    }
    loadProducts();
    // Default form sbu hook
    const userSbu = localStorage.getItem("user_sbu") || "";
    setSbuId(localStorage.getItem("user_sbu_id") || "3e4df6aa-0000-0000-0000-000000000000");
  }, []);

  function addLine() {
    setLines((prev) => [...prev, { product_id: "", requested_quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (lines.some((l) => !l.product_id || l.requested_quantity < 1)) {
      setError("All line items must have a valid product selected and quantity ≥ 1.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/transfer-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sbu_id: sbuId,
          required_date: requiredDate || undefined,
          estimated_value: estimatedValue ? Number(estimatedValue) : undefined,
          notes: notes || undefined,
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      router.push(`/requests?created=${data.reference_number}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Breadcrumbs & Title */}
        <div>
          <nav className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Link className="hover:text-primary transition-all" href="/requests">Requests</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-on-surface font-extrabold text-primary">New Transfer Request</span>
          </nav>
          <h2 className="text-2xl font-extrabold text-on-surface font-sans">New Transfer Request</h2>
          <p className="text-xs text-slate-500 mt-1">Initiate internal stock movement between sub-units or warehouses.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Form parameters */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 flex flex-col gap-4 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b border-outline-variant pb-2">
                Request Parameters
              </h3>

              {/* Required Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="required_date">
                  Required Date
                </label>
                <input
                  id="required_date"
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-sans"
                />
              </div>

              {/* Estimated Value */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="estimated_value">
                  Estimated Value (KES)
                </label>
                <input
                  id="estimated_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-sans font-semibold placeholder:text-outline-variant"
                  placeholder="0.00"
                />
                <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                  Transfers at or above the configured SBU monthly thresholds require Finance approval.
                </p>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider" htmlFor="notes">
                  Notes / Justification
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Reason for transfer, special handling instructions..."
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline-variant font-medium"
                />
              </div>
            </div>

            {/* Transfer Policy Widget */}
            <div className="bg-sky-50/50 border border-sky-200 rounded-xl p-5 shadow-sm text-sky-900 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-700" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-sky-800">Transfer Policy</h4>
              </div>
              <ul className="text-xs list-disc pl-4 space-y-1.5 text-sky-950 font-medium">
                <li>All internal transfers must be balanced within 48 hours.</li>
                <li>Transit losses must be reported immediately.</li>
                <li>Warehouse digital signature is mandatory on receipt.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Line items */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant p-6 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3 mb-1">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Line Items
              </h3>
              <button
                type="button"
                onClick={addLine}
                className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-primary font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>

            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50/40 border border-slate-100 rounded-xl p-4 relative group">
                <div className="sm:col-span-8 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Product</label>
                  <select
                    required
                    value={line.product_id}
                    onChange={(e) => updateLine(i, "product_id", e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer font-semibold text-slate-700"
                  >
                    <option value="">Select Product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — {p.uom}
                      </option>
                    ))}
                    {products.length === 0 && (
                      <option value="demo_id">Sample Industrial Compressor (UOM: Unit)</option>
                    )}
                  </select>
                </div>

                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Qty</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={line.requested_quantity}
                    onChange={(e) => updateLine(i, "requested_quantity", Number(e.target.value))}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono font-bold text-slate-700"
                    placeholder="1"
                  />
                </div>

                {lines.length > 1 && (
                  <div className="sm:col-span-1 flex justify-center pt-5">
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 text-rose-600 rounded-lg cursor-pointer transition-colors"
                      title="Remove product"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-semibold mt-2 animate-bounce">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 border-t border-outline-variant/60 pt-4">
              <Link
                href="/requests"
                className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-all text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#0F766E] hover:bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:shadow"
              >
                {submitting ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

