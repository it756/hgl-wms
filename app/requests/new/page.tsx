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
  unit_cost: number | null;
}

interface SBUUnit {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export default function NewTransferRequestPage() {
  const router = useRouter();
  const [sbuId, setSbuId] = useState("");
  const [requestingUnitId, setRequestingUnitId] = useState("");
  const [units, setUnits] = useState<SBUUnit[]>([]);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ product_id: "", requested_quantity: 0 }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadProductsAndUnits() {
      const token = localStorage.getItem("access_token");
      const role = localStorage.getItem("user_role") ?? "";

      // Pre-fill SBU from localStorage
      setSbuId(localStorage.getItem("user_sbu_id") ?? "");

      // For UNIT_STAFF, auto-fill their assigned unit
      if (role === "UNIT_STAFF") {
        const unitId = localStorage.getItem("user_unit_id") ?? "";
        if (unitId) setRequestingUnitId(unitId);
      }

      try {
        const [prodRes, unitsRes] = await Promise.all([
          fetch("/api/bu/catalogue", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/bu/units", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (prodRes.ok) setProducts((await prodRes.json()) || []);
        if (unitsRes.ok) {
          setUnits((await unitsRes.json()) || []);
        } else {
          let errMsg = "Could not load units.";
          try {
            const d = await unitsRes.json();
            errMsg = d.error || errMsg;
          } catch {
            // response wasn't JSON (e.g. an HTML 404 page — restart dev server)
          }
          setUnitsError(errMsg);
        }
      } catch (err) {
        console.error("Data prefetch failed", err);
      }
    }
    loadProductsAndUnits();
  }, []);

  const estimatedValue = lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.product_id);
    const cost = product?.unit_cost ?? 0;
    return sum + cost * line.requested_quantity;
  }, 0);

  function addLine() {
    setLines((prev) => [...prev, { product_id: "", requested_quantity: 0 }]);
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

    if (!requestingUnitId) {
      setError("Please select the requesting unit before submitting.");
      return;
    }

    if (lines.some((l) => !l.product_id || l.requested_quantity < 1)) {
      setError("All line items must have a valid product selected and quantity ≥ 1.");
      return;
    }

    setSubmitting(true);

    // Optimistic submit: persist a "pending" record to sessionStorage and
    // navigate to the list page immediately. The actual POST is performed by
    // the list page so the user sees their new request as a SUBMITTING row
    // straight away. On failure, the list page surfaces Retry / Discard.
    const unit = units.find((u) => u.id === requestingUnitId) ?? null;
    const clientId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const optimistic = {
      clientId,
      status: "SUBMITTING" as const,
      created_at: new Date().toISOString(),
      payload: {
        requesting_unit_id: requestingUnitId,
        required_date: requiredDate || undefined,
        estimated_value: estimatedValue > 0 ? estimatedValue : undefined,
        notes: notes || undefined,
        lines,
      },
      snapshot: {
        unit: unit ? { id: unit.id, name: unit.name, code: unit.code } : null,
        estimated_value: estimatedValue > 0 ? estimatedValue : null,
        required_date: requiredDate || null,
      },
    };

    try {
      sessionStorage.setItem("pending_transfer_request", JSON.stringify(optimistic));
    } catch {
      // sessionStorage may be unavailable (private mode, quota); fall back to
      // the original blocking flow rather than losing the request silently.
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/transfer-requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(optimistic.payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Submission failed");
        router.push(`/requests?created=${data.reference_number}`);
      } catch (err: any) {
        setError(err.message ?? "Submission failed");
        setSubmitting(false);
      }
      return;
    }

    router.push("/requests");
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Breadcrumbs & Title */}
        <div>
          <nav className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Link className="hover:text-primary transition-all" href="/requests">
              Requests
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-on-surface font-extrabold text-primary">
              New Transfer Request
            </span>
          </nav>
          <h2 className="text-2xl font-extrabold text-on-surface font-sans">
            New Transfer Request
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Initiate internal stock movement between sub-units or warehouses.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Form parameters */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 flex flex-col gap-4 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b border-outline-variant pb-2">
                Request Parameters
              </h3>

              {/* Requesting Unit */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                  htmlFor="requesting_unit"
                >
                  Requesting Unit <span className="text-rose-500">*</span>
                </label>
                {unitsError ? (
                  <p className="text-xs text-rose-600 font-semibold">{unitsError}</p>
                ) : (
                  <select
                    id="requesting_unit"
                    required
                    value={requestingUnitId}
                    onChange={(e) => setRequestingUnitId(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer font-semibold text-slate-700"
                  >
                    <option value="">Select Unit...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Required Date */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                  htmlFor="required_date"
                >
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

              {/* Estimated Value (auto-calculated) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Total Value (ZMW)
                </label>
                <div className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-slate-50 font-mono font-bold text-slate-700 select-none">
                  {estimatedValue.toLocaleString("en-ZM", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                  Auto-calculated from line item quantities &times; unit costs. Transfers at or
                  above the configured SBU monthly thresholds require Finance approval.
                </p>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                  htmlFor="notes"
                >
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
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-sky-800">
                  Transfer Policy
                </h4>
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
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50/40 border border-slate-100 rounded-xl p-4 relative group"
              >
                <div className="sm:col-span-8 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Product
                  </label>
                  <select
                    required
                    value={line.product_id}
                    onChange={(e) => updateLine(i, "product_id", e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer font-semibold text-slate-700"
                  >
                    <option value="">Select Product...</option>
                    {products
                      .filter(
                        (p) =>
                          p.id === line.product_id ||
                          !lines.some((l, j) => j !== i && l.product_id === p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.uom}
                        </option>
                      ))}
                    {products.length === 0 && (
                      <option value="" disabled>
                        No products in your SBU&apos;s warehouse catalogue
                      </option>
                    )}
                  </select>
                </div>

                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Qty
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={line.requested_quantity || ""}
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
