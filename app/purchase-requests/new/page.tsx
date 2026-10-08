"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import CatalogueProductPicker from "@/components/CatalogueProductPicker";
import type { CatalogueProduct } from "@/lib/catalogue";

interface LineItem {
  product_id: string;
  product_name: string;
  sku: string;
  unit_cost: number | null;
  unit_of_measure: string;
  quantity_requested: number;
  notes: string;
}

const defaultLine = (): LineItem => ({
  product_id: "",
  product_name: "",
  sku: "",
  unit_cost: null,
  unit_of_measure: "",
  quantity_requested: 1,
  notes: "",
});

function normalizeQuantity(value: string | number): number {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.round(quantity));
}

function NewPurchaseRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [procurementEmail, setProcurementEmail] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([defaultLine()]);
  const [requestLoading, setRequestLoading] = useState(Boolean(editId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem("access_token");
      if (!editId) return;
      setRequestLoading(true);
      try {
        const pr = await fetch(`/api/purchase-requests/${editId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!pr.ok) throw new Error("Could not load the purchase request.");
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
                  product_name?: string;
                  sku?: string | null;
                  unit_cost?: number | null;
                  unit_of_measure?: string;
                  quantity_requested: number;
                  notes: string | null;
                }) => ({
                  product_id: l.product_id ?? "",
                  product_name: l.product_name ?? "",
                  sku: l.sku ?? "",
                  unit_cost: l.unit_cost ?? null,
                  unit_of_measure: l.unit_of_measure ?? "",
                  quantity_requested: l.quantity_requested,
                  notes: l.notes ?? "",
                }),
              ),
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the purchase request.");
      } finally {
        setRequestLoading(false);
      }
    }
    init();
  }, [editId]);

  function getProduct(line: LineItem): CatalogueProduct | null {
    return line.product_id
      ? {
          id: line.product_id,
          name: line.product_name,
          sku: line.sku,
          uom: line.unit_of_measure,
          unit_cost: line.unit_cost,
          stock_quantity: 0,
        }
      : null;
  }

  const estimatedTotal = lines.reduce(
    (sum, line) => sum + line.quantity_requested * (line.unit_cost ?? 0),
    0,
  );

  function addLine() {
    setLines((prev) => [...prev, defaultLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number | null) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [field]: value };
        return updated;
      }),
    );
  }

  function selectProduct(index: number, product: CatalogueProduct | null) {
    setLines((previous) =>
      previous.map((line, i) =>
        i !== index
          ? line
          : {
              ...line,
              product_id: product?.id ?? "",
              product_name: product?.name ?? "",
              sku: product?.sku ?? "",
              unit_cost: product?.unit_cost ?? null,
              unit_of_measure: product?.uom ?? "",
            },
      ),
    );
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
          return {
            product_id: l.product_id,
            product_name: l.product_name,
            sku: l.sku || undefined,
            quantity_requested: normalizeQuantity(l.quantity_requested),
            unit_cost: l.unit_cost ?? undefined,
            unit_of_measure: l.unit_of_measure || "units",
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/purchase-requests"
          className="text-slate-400 hover:text-slate-600"
          aria-label="Back to purchase requests"
        >
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Supplier Ltd."
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
              placeholder="Any additional context for procurement…"
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

          {requestLoading ? (
            <p className="text-sm text-slate-600">Loading purchase request...</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, index) => {
                const selectedProduct = getProduct(line);
                return (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-lg"
                  >
                    {/* Product select */}
                    <div className="col-span-12 sm:col-span-5">
                      <CatalogueProductPicker
                        value={selectedProduct}
                        onChange={(product) => selectProduct(index, product)}
                        required
                      />
                    </div>

                    {/* Auto-filled product info */}
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Unit</label>
                      <input
                        type="text"
                        readOnly
                        value={selectedProduct?.uom ?? "—"}
                        className="w-full border border-slate-100 rounded px-2 py-1.5 text-sm bg-slate-100 text-slate-500 cursor-default"
                        tabIndex={-1}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Unit Cost (ZMW)</label>
                      <input
                        type="text"
                        readOnly
                        value={
                          selectedProduct?.unit_cost != null
                            ? selectedProduct.unit_cost.toLocaleString()
                            : "—"
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
                          updateLine(index, "quantity_requested", parseInt(e.target.value, 10) || 1)
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
                          aria-label="Remove line item"
                          title="Remove line"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Optional line notes — full-width second row */}
                    <div className="col-span-12">
                      <input
                        type="text"
                        value={line.notes}
                        onChange={(e) => updateLine(index, "notes", e.target.value)}
                        placeholder="Line notes (optional)…"
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
                <strong className="text-slate-800">ZMW {estimatedTotal.toLocaleString()}</strong>
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
            disabled={submitting || requestLoading}
            className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={submitting || requestLoading}
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
            className="bg-primary hover:bg-primary/95 text-white rounded-lg px-5 py-2.5 text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:shadow-md cursor-pointer active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Submitting…" : "Save & Send to Procurement"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewPurchaseRequestPage() {
  return (
    <Suspense>
      <NewPurchaseRequestContent />
    </Suspense>
  );
}
