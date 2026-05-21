"use client";

import { useState } from "react";

interface LineItem {
  product_id: string;
  product_name: string;
  sku: string;
  unit_of_measure: string;
  quantity_received: number;
  unit_cost: number | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit_of_measure: string;
  unit_cost: number | null;
}

export default function SupplierGRNPage() {
  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<LineItem[]>([
    {
      product_id: "",
      product_name: "",
      sku: "",
      unit_of_measure: "unit",
      quantity_received: 1,
      unit_cost: null,
    },
  ]);
  const [productSearch, setProductSearch] = useState<string[]>([""]);
  const [productOptions, setProductOptions] = useState<ProductOption[][]>([[]]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  async function searchProducts(idx: number, query: string) {
    const searches = [...productSearch];
    searches[idx] = query;
    setProductSearch(searches);
    if (query.length < 2) return;
    const res = await fetch(`/api/admin/products?search=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    const opts = [...productOptions];
    opts[idx] = data;
    setProductOptions(opts);
  }

  function selectProduct(idx: number, p: ProductOption) {
    const updated = [...lines];
    updated[idx] = {
      ...updated[idx],
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      unit_of_measure: p.unit_of_measure,
      unit_cost: p.unit_cost,
    };
    setLines(updated);
    const searches = [...productSearch];
    searches[idx] = p.name;
    setProductSearch(searches);
    const opts = [...productOptions];
    opts[idx] = [];
    setProductOptions(opts);
  }

  function addLine() {
    setLines([
      ...lines,
      {
        product_id: "",
        product_name: "",
        sku: "",
        unit_of_measure: "unit",
        quantity_received: 1,
        unit_cost: null,
      },
    ]);
    setProductSearch([...productSearch, ""]);
    setProductOptions([...productOptions, []]);
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
    setProductSearch(productSearch.filter((_, i) => i !== idx));
    setProductOptions(productOptions.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) {
      setError("Supplier name is required");
      return;
    }
    if (lines.some((l) => !l.product_id)) {
      setError("All line items must have a product selected");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supplier-grns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          supplier_name: supplier,
          invoice_reference: invoiceRef || undefined,
          invoice_amount: invoiceAmount ? Number(invoiceAmount) : undefined,
          date_received: dateReceived,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity_received: l.quantity_received,
            unit_cost: l.unit_cost,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Supplier GRN ${data.reference_number} submitted. Awaiting Finance approval.`);
      setSupplier("");
      setInvoiceRef("");
      setInvoiceAmount("");
      setLines([
        {
          product_id: "",
          product_name: "",
          sku: "",
          unit_of_measure: "unit",
          quantity_received: 1,
          unit_cost: null,
        },
      ]);
      setProductSearch([""]);
      setProductOptions([[]]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Record Supplier GRN</h1>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded px-4 py-3 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Finance notice */}
      <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-3 text-sm">
        This GRN will be reviewed by the Finance Manager before stock levels are updated.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Supplier Name *</label>
            <input
              required
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Invoice Reference</label>
            <input
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Invoice Amount (KES)</label>
            <input
              type="number"
              step="0.01"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Date Received *</label>
            <input
              type="date"
              required
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-sm">Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="text-teal-700 text-sm hover:underline"
            >
              + Add Product
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Product", "UoM", "Qty Received", "Unit Cost", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 relative">
                    <input
                      value={productSearch[idx]}
                      onChange={(e) => searchProducts(idx, e.target.value)}
                      placeholder="Search product…"
                      className="border rounded px-2 py-1 text-sm w-44"
                    />
                    {productOptions[idx]?.length > 0 && (
                      <ul className="absolute z-10 bg-white border rounded shadow text-xs w-44 max-h-40 overflow-y-auto">
                        {productOptions[idx].map((p) => (
                          <li
                            key={p.id}
                            onClick={() => selectProduct(idx, p)}
                            className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer"
                          >
                            {p.name} <span className="text-gray-400">({p.sku})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{line.unit_of_measure}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      value={line.quantity_received}
                      onChange={(e) => {
                        const u = [...lines];
                        u[idx].quantity_received = Number(e.target.value);
                        setLines(u);
                      }}
                      className="border rounded px-2 py-1 text-sm w-20"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_cost ?? ""}
                      onChange={(e) => {
                        const u = [...lines];
                        u[idx].unit_cost = e.target.value ? Number(e.target.value) : null;
                        setLines(u);
                      }}
                      placeholder="Optional"
                      className="border rounded px-2 py-1 text-sm w-24"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-red-500 hover:text-red-700 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="border rounded px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-700 text-white rounded px-5 py-2 text-sm disabled:opacity-50 hover:bg-teal-800"
          >
            {loading ? "Submitting…" : "Submit Supplier GRN"}
          </button>
        </div>
      </form>
    </main>
  );
}
