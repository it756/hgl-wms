"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle,
  Calendar,
  ArrowLeft,
  AlertCircle,
  Truck,
  Info,
  FileText,
  Layers,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

interface IssuedTransfer {
  id: string;
  reference_number: string;
  sbu_id: string;
  issuance_id?: string;
  transfer_line_items: {
    product_id: string;
    requested_quantity: number;
    product_name?: string;
    sku?: string;
  }[];
}

interface GRNLineItemInput {
  product_id: string;
  product_name: string;
  sku: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes?: string;
}

export default function SubmitGRNPage() {
  const [transfers, setTransfers] = useState<IssuedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grnItems, setGrnItems] = useState<GRNLineItemInput[]>([]);
  const [conditionNotes, setConditionNotes] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/transfer-requests?status=ISSUED", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const enriched = (data ?? []).map((t: any) => ({
          ...t,
          transfer_line_items: (t.transfer_line_items ?? []).map((line: any) => ({
            ...line,
            product_name: line.products?.name ?? `Product ${line.product_id}`,
            sku: line.products?.sku ?? "",
          })),
        }));
        setTransfers(enriched);
      } catch (err: any) {
        setError(err.message || "Failed to load issued transfers.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function selectTransfer(t: IssuedTransfer) {
    setSelectedId(t.id);
    setGrnItems(
      t.transfer_line_items.map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name || `Product Code ${l.product_id}`,
        sku: l.sku || `SKU-${l.product_id}`,
        issued_quantity: l.requested_quantity,
        quantity_received: l.requested_quantity,
        variance_notes: "",
      })),
    );
    setError(null);
    setSuccess(null);
  }

  function updateGRNItem(idx: number, field: keyof GRNLineItemInput, value: string | number) {
    setGrnItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  async function submitGRN() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/grns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transfer_request_id: selectedId,
          date_received: dateReceived,
          condition_notes: conditionNotes || undefined,
          items: grnItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "GRN submission failed");
      setSuccess(
        `GRN ${data.reference_number || "GRN-2023-4552"} submitted. Transfer is now marked as completed.`,
      );
      setSelectedId(null);
      setGrnItems([]);
      setTransfers((prev) => prev.filter((t) => t.id !== selectedId));
    } catch (err: any) {
      setError(err.message || "GRN submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Dynamic header breadcrumb */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <span>Inbound Logistics</span>
            <span className="text-slate-300">/</span>
            <span className="text-primary">Receive SBU Transfer</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
            Receive Goods Received Note (GRN)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Verify quantities, record physical conditions, note variances on inbound transfers, and
            update available stock.
          </p>
        </div>

        {/* Status Alerts */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-4 text-sm flex items-start gap-3 shadow-sm animate-fadeIn duration-150">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-slate-900 leading-normal">Verification Complete</p>
              <p className="text-slate-650 font-medium text-xs mt-0.5">{success}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-5 py-4 text-sm flex items-start gap-3 shadow-sm animate-fadeIn duration-150">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-slate-900 leading-normal">System Action Failed</p>
              <p className="text-rose-650 font-medium text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto mb-3"></div>
            <p className="text-[#64748B] text-xs font-bold uppercase tracking-wider">
              Loading issued transfers…
            </p>
          </div>
        ) : transfers.length === 0 && !selectedId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-16 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <ClipboardList className="w-7 h-7" />
            </div>
            <p className="text-[#1E293B] font-extrabold text-base">No Transfers Awaiting GRN</p>
            <p className="text-slate-450 text-xs mt-1 max-w-sm mx-auto">
              All warehouse transfers are currently in finished states. Dispatched requests will
              populate here once out for delivery.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {!selectedId && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-extrabold text-[#1E293B] uppercase tracking-wider">
                    Select Dispatched Transfer
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mb-4 font-semibold">
                  The following transfers have been successfully dispatched by unit
                  staffs/operations and are awaiting arrival verification:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {transfers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => selectTransfer(t)}
                      className="group relative flex flex-col text-left border border-slate-200 rounded-xl p-5 hover:border-primary hover:bg-slate-50/50 transition duration-200 shadow-2xs"
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <span className="font-mono font-black text-slate-900 text-sm group-hover:text-primary transition">
                          {t.reference_number}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 uppercase tracking-widest leading-none">
                          In-Transit
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-3">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>SBU ID:</span>
                        <span className="text-slate-700 font-black">{t.sbu_id}</span>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto w-full text-[11px] text-slate-400 group-hover:text-slate-600 transition font-bold uppercase tracking-wider">
                        <span>{t.transfer_line_items.length} item(s) to verify</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition duration-150" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedId && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Input fields */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Line Items Card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                    <div className="flex items-center justify-between gap-4 mb-4 border-b border-rose-50 pb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        <h2 className="text-sm font-extrabold text-[#1E293B] uppercase tracking-wider">
                          Line Item Audit
                        </h2>
                      </div>
                      <span className="font-mono text-xs font-black text-slate-500">
                        {transfers.find((t) => t.id === selectedId)?.reference_number}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-semibold mb-4 leading-normal">
                      Examine each product received. Verify that quantities align exactly. Note any
                      differences as variance logs for reconciliation.
                    </p>

                    <div className="space-y-4">
                      {grnItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-100 bg-slate-50/30 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-extrabold text-slate-900 leading-normal">
                                {item.product_name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5 uppercase tracking-wide">
                                SKU: {item.sku}
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-slate-420 font-bold">
                              ID: {item.product_id}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                                Issued Qty
                              </label>
                              <input
                                type="number"
                                value={item.issued_quantity}
                                readOnly
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-100 font-mono text-slate-550 font-bold leading-normal"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                                Received Qty
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={item.quantity_received}
                                onChange={(e) =>
                                  updateGRNItem(idx, "quantity_received", Number(e.target.value))
                                }
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 font-extrabold focus:border-primary focus:outline-hidden leading-normal"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                                Variance Notes
                              </label>
                              <input
                                type="text"
                                value={item.variance_notes ?? ""}
                                onChange={(e) =>
                                  updateGRNItem(idx, "variance_notes", e.target.value)
                                }
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-semibold focus:border-primary focus:outline-hidden leading-normal"
                                placeholder="e.g. Broken packaging, -5 count"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Metadata & Controls Card */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sticky top-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-primary" />
                      <h2 className="text-sm font-extrabold text-[#1E293B] uppercase tracking-wider">
                        Arrival Details
                      </h2>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                          Date Received
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={dateReceived}
                            onChange={(e) => setDateReceived(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-750 focus:border-primary focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                          General Condition Notes
                        </label>
                        <textarea
                          value={conditionNotes}
                          onChange={(e) => setConditionNotes(e.target.value)}
                          rows={3}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-semibold focus:border-primary focus:outline-hidden leading-relaxed"
                          placeholder="Note down structural damage, delivery truck condition or seal integrity remarks..."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                      <button
                        onClick={submitGRN}
                        disabled={submitting}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-lg transition shadow-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {submitting ? "Verifying..." : "Verify & Complete GRN"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedId(null);
                          setGrnItems([]);
                        }}
                        className="w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg transition uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Change Transfer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
