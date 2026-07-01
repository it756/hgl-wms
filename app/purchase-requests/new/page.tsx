"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Trash, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

interface CatalogueProduct {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unit_cost: number | null;
}

interface LineItem {
  product_id: string;
  quantity_requested: number;
  notes: string;
}

const defaultLine = (): LineItem => ({
  product_id: "",
  quantity_requested: 1,
  notes: "",
});

function NewPurchaseRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [procurementEmail, setProcurementEmail] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([defaultLine()]);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem("access_token");
      try {
        const res = await fetch("/api/bu/catalogue", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setProducts((await res.json()) ?? []);
      } catch {
        // catalogue load failure is non-fatal; user will see an empty dropdown
      } finally {
        setProductsLoading(false);
      }

      if (editId) {
        const pr = await fetch(`/api/purchase-requests/${editId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (pr.ok) {
          const data = await pr.json();
          setProcurementEmail(data.procurement_email ?? "");
          setSupplierName(data.supplier_name ?? "");
          setSupplierEmail(data.supplier_email ?? "");
          setNotes(data.notes ?? "");
          if (
            Array.isArray(data.purchase_request_line_items) &&
            data.purchase_request_line_items.length > 0
          ) {
            setLines(
              data.purchase_request_line_items.map(
                (l: {
                  product_id: string | null;
                  quantity_requested: number;
                  notes: string | null;
                }) => ({
                  product_id: l.product_id ?? "",
                  quantity_requested: l.quantity_requested,
                  notes: l.notes ?? "",
                }),
              ),
            );
          }
        }
      }
    }
    init();
  }, [editId]);

  function getProduct(id: string): CatalogueProduct | undefined {
    return products.find((p) => p.id === id);
  }

  const estimatedTotal = lines.reduce((sum, l) => {
    const cost = getProduct(l.product_id)?.unit_cost ?? 0;
    return sum + l.quantity_requested * cost;
  }, 0);

  function addLine() {
    setLines((prev) => [...prev, defaultLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent, sendToProcurement = false) {
    e.preventDefault();
    setError(null);

    if (!procurementEmail.trim()) {
      setError("Procurement email is required.");
      return;
    }
    if (lines.some((l) => !l.product_id)) {
      setError("All line items must have a product selected.");
      return;
    }
    if (lines.some((l) => l.quantity_requested < 1)) {
      setError("All quantities must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      const authToken = localStorage.getItem("access_token");

      const payload = {
        procurement_email: procurementEmail.trim(),
        supplier_name: supplierName.trim() || undefined,
        supplier_email: supplierEmail.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => {
          const prod = getProduct(l.product_id);
          return {
            product_id: l.product_id,
            product_name: prod?.name ?? l.product_id,
            sku: prod?.sku || undefined,
            quantity_requested: Number(l.quantity_requested),
            unit_cost: prod?.unit_cost ?? undefined,
            unit_of_measure: prod?.uom || "units",
            notes: l.notes.trim() || undefined,
          };
        }),
      };

      let id: string;
      let reference: string;

      if (editId) {
        const res = await fetch(`/api/purchase-requests/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        id = editId;
        reference = data.reference_number;
      } else {
        const res = await fetch("/api/purchase-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create");
        id = data.id;
        reference = data.reference_number;
      }

      if (sendToProcurement) {
        const submitRes = await fetch(`/api/purchase-requests/${id}/submit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) throw new Error(submitData.error || "Failed to submit to procurement");
        router.push(`/purchase-requests?created=${reference}&submitted=true`);
      } else {
        router.push(`/purchase-requests?created=${reference}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/purchase-requests" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {editId ? "Edit Purchase Request" : "New Purchase Request"}
            </h1>
            <p className="text-sm text-slate-500">
              Create a purchase request to send to external procurement for approval.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* Request Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-700">Request Details</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Procurement Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={procurementEmail}
                onChange={(e) => setProcurementEmail(e.target.value)}
                placeholder="procurement@company.com"
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <p className="text-xs text-slate-400 mt-1">
                A secure review link will be emailed here when you submit.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Supplier Ltd."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Supplier Email
                </label>
                <input
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="supplier@example.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional context for procurementâ€¦"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">Requested Items</h2>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {productsLoading ? (
              <p className="text-sm text-slate-400">Loading product catalogueâ€¦</p>
            ) : products.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
                No products found in your SBU catalogue. Contact your Warehouse Manager to ensure
                products have been added to the inventory.
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => {
                  const selectedProduct = getProduct(line.product_id);
                  return (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-lg"
                    >
                      {/* Product select */}
                      <div className="col-span-12 sm:col-span-5">
                        <label className="block text-xs text-slate-500 mb-1">
                          Product <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={line.product_id}
                          onChange={(e) => updateLine(index, "product_id", e.target.value)}
                          required
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                        >
                          <option value="">Select productâ€¦</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Auto-filled product info */}
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit</label>
                        <input
                          type="text"
                          readOnly
                          value={selectedProduct?.uom ?? "â€”"}
                          className="w-full border border-slate-100 rounded px-2 py-1.5 text-sm bg-slate-100 text-slate-500 cursor-default"
                          tabIndex={-1}
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit Cost (KES)</label>
                        <input
                          type="text"
                          readOnly
                          value={
                            selectedProduct?.unit_cost != null
                              ? selectedProduct.unit_cost.toLocaleString()
                              : "â€”"
                          }
                          className="w-full border border-slate-100 rounded px-2 py-1.5 text-sm bg-slate-100 text-slate-500 cursor-default"
                          tabIndex={-1}
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity_requested}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "quantity_requested",
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                        />
                      </div>

                      {/* Remove */}
                      <div className="col-span-12 sm:col-span-1 flex items-end justify-end sm:justify-center pb-0.5">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Remove line"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Optional line notes â€” full-width second row */}
                      <div className="col-span-12">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => updateLine(index, "notes", e.target.value)}
                          placeholder="Line notes (optional)â€¦"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {estimatedTotal > 0 && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  Estimated Total:{" "}
                  <strong className="text-slate-800">KES {estimatedTotal.toLocaleString()}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
            <Link
              href="/purchase-requests"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || productsLoading}
              className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={submitting || productsLoading}
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
              className="bg-primary hover:bg-primary/95 text-white rounded-lg px-5 py-2.5 text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:shadow-md cursor-pointer active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Submittingâ€¦" : "Save & Send to Procurement"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default function NewPurchaseRequestPage() {
  return (
    <Suspense>
      <NewPurchaseRequestContent />
    </Suspense>
  );
}
