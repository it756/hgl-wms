"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Package,
  RotateCcw,
  Info,
  ClipboardList,
} from "lucide-react";

interface CompletedTransfer {
  id: string;
  reference_number: string;
  sbu_id: string;
  created_at: string;
  transfer_line_items: {
    product_id: string;
    requested_quantity: number;
    product_name: string;
    sku: string;
  }[];
}

interface ReturnLineItem {
  product_id: string;
  product_name: string;
  sku: string;
  issued_quantity: number;
  quantity_to_return: number;
}

export default function NewReturnPage() {
  const [transfers, setTransfers] = useState<CompletedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState<CompletedTransfer | null>(null);
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/transfer-requests?status=COMPLETED", {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const enriched = (data ?? []).map((t: any) => ({
          ...t,
          transfer_line_items: (t.transfer_line_items ?? []).map((l: any) => ({
            ...l,
            product_name: l.products?.name ?? `Product ${l.product_id}`,
            sku: l.products?.sku ?? "",
          })),
        }));
        setTransfers(enriched);
      } catch (err: any) {
        setError(err.message || "Failed to load completed transfers.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function selectTransfer(t: CompletedTransfer) {
    setSelectedTransfer(t);
    setLineItems(
      t.transfer_line_items.map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        sku: l.sku,
        issued_quantity: l.requested_quantity,
        quantity_to_return: 0,
      })),
    );
    setError(null);
    setSuccess(null);
  }

  function updateQty(idx: number, val: number) {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, quantity_to_return: Math.min(Math.max(0, val), item.issued_quantity) }
          : item,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTransfer) return;
    if (!reason.trim()) {
      setError("A reason for return is required.");
      return;
    }
    const itemsToReturn = lineItems.filter((l) => l.quantity_to_return > 0);
    if (itemsToReturn.length === 0) {
      setError("At least one item must have a return quantity greater than 0.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/return-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          original_transfer_request_id: selectedTransfer.id,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          items: itemsToReturn.map((l) => ({
            product_id: l.product_id,
            quantity_to_return: l.quantity_to_return,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSuccess(
        `Return request ${data.reference_number} submitted successfully. Awaiting BU Manager approval.`,
      );
      setSelectedTransfer(null);
      setLineItems([]);
      setReason("");
      setNotes("");
    } catch (err: any) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Breadcrumb + Header */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Returns</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary">New Return Request</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
            Raise a Return Request
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Select a completed transfer, specify items and quantities to return, and provide a reason. Your BU Manager will review and approve before the warehouse receives the goods.
          </p>
        </div>

        {/* Alerts */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-4 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-slate-900">Return Submitted</p>
              <p className="text-xs font-medium mt-0.5">{success}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-5 py-4 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-slate-900">Action Required</p>
              <p className="text-xs font-medium mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-primary mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Loading completed transfers…
            </p>
          </div>
        ) : !selectedTransfer ? (
          /* Step 1 — Select a completed transfer */
          transfers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-14 text-center flex flex-col items-center gap-3">
              <ClipboardList className="w-10 h-10 text-slate-200" />
              <p className="font-extrabold text-slate-700">No Completed Transfers</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Returns can only be raised against completed transfers. None found for your SBU yet.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center gap-2 mb-4">
                <RotateCcw className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-extrabold text-[#1E293B] uppercase tracking-wider">
                  Select Transfer to Return From
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-5 font-semibold">
                Only completed transfers from your SBU are listed below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transfers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTransfer(t)}
                    className="group text-left border border-slate-200 rounded-xl p-5 hover:border-primary hover:bg-slate-50/50 transition shadow-2xs flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-slate-900 text-sm group-hover:text-primary transition">
                        {t.reference_number}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-widest">
                        Completed
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{t.transfer_line_items.length} line item(s)</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>Select to return items</span>
                      <ChevronRight className="w-4 h-4 group-hover:text-primary group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Step 2 — Fill return form */
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Change transfer
              </button>
              <span className="text-slate-300 text-sm">|</span>
              <span className="text-sm font-extrabold text-slate-700 font-mono">
                {selectedTransfer.reference_number}
              </span>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center gap-2 mb-5">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-extrabold text-[#1E293B] uppercase tracking-wider">
                  Return Quantities
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                      <th className="text-left py-2 pr-4 font-extrabold">Product</th>
                      <th className="text-left py-2 pr-4 font-extrabold">SKU</th>
                      <th className="text-center py-2 pr-4 font-extrabold">Issued Qty</th>
                      <th className="text-center py-2 font-extrabold">Qty to Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={item.product_id} className="border-b border-slate-50 last:border-0">
                        <td className="py-3 pr-4 font-semibold text-slate-800">{item.product_name}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">{item.sku}</td>
                        <td className="py-3 pr-4 text-center text-slate-600 font-bold">
                          {item.issued_quantity}
                        </td>
                        <td className="py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={item.issued_quantity}
                            value={item.quantity_to_return}
                            onChange={(e) => updateQty(idx, Number(e.target.value))}
                            className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reason + Notes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Reason for Return <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Items arrived damaged, excess stock, wrong product delivered…"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Additional Notes <span className="text-slate-400 font-medium">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any further details for the BU Manager or warehouse…"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-white font-extrabold text-sm px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Submit Return Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
