"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import {
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Truck,
  Info,
  FileText,
  Layers,
  ChevronRight,
  ClipboardList,
  Paperclip,
} from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";

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
  quantity_received: number | "";
  variance_notes?: string;
}

interface GRNHistoryRecord {
  id: string;
  transfer_request_id: string;
  date_received: string;
  condition_notes: string | null;
  has_variance: boolean;
  created_at: string;
  transfer_requests: {
    reference_number: string;
    status: string;
    sbus: { name: string; code: string } | null;
  } | null;
  grn_line_items: {
    id: string;
    issued_quantity: number;
    quantity_received: number;
    products: { name: string; sku: string; unit_of_measure: string } | null;
  }[];
}

export default function SubmitGRNPage() {
  const [transfers, setTransfers] = useState<IssuedTransfer[]>([]);
  const [grnHistory, setGrnHistory] = useState<GRNHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grnItems, setGrnItems] = useState<GRNLineItemInput[]>([]);
  const [conditionNotes, setConditionNotes] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedGrn, setSubmittedGrn] = useState<{
    grnId: string;
    referenceNumber: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("access_token");
        const [transfersRes, grnsRes] = await Promise.all([
          fetch("/api/transfer-requests?status=ISSUED", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/grns?mine=true", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const [data, grnData] = await Promise.all([transfersRes.json(), grnsRes.json()]);
        if (!transfersRes.ok) throw new Error(data.error);
        if (!grnsRes.ok) throw new Error(grnData.error);
        const enriched = (data ?? []).map((t: any) => ({
          ...t,
          transfer_line_items: (t.transfer_line_items ?? []).map((line: any) => ({
            ...line,
            product_name: line.products?.name ?? `Product ${line.product_id}`,
            sku: line.products?.sku ?? "",
          })),
        }));
        setTransfers(enriched);
        setGrnHistory(grnData ?? []);
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
        quantity_received: "",
        variance_notes: "",
      })),
    );
    setError(null);
    setSuccess(null);
  }

  function updateGRNItem(idx: number, field: keyof GRNLineItemInput, value: string | number) {
    setGrnItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  const canVerifyGRN =
    selectedId !== null &&
    grnItems.length > 0 &&
    grnItems.every(
      (item) =>
        item.quantity_received !== "" &&
        Number.isFinite(item.quantity_received) &&
        item.quantity_received >= 0,
    );

  async function submitGRN() {
    if (!selectedId || !canVerifyGRN) return;
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
          items: grnItems.map((item) => ({
            ...item,
            quantity_received: Number(item.quantity_received),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "GRN submission failed");
      const grnId: string | null = data?.grnId ?? null;
      setSuccess(
        `GRN submitted. Transfer is now marked as ${data.status?.replace(/_/g, " ") ?? "completed"}.`,
      );
      if (grnId) {
        setSubmittedGrn({
          grnId,
          referenceNumber: transfers.find((t) => t.id === selectedId)?.reference_number ?? "",
        });
      }
      setSelectedId(null);
      setGrnItems([]);
      setTransfers((prev) => prev.filter((t) => t.id !== selectedId));
      setActiveTab("history");
      const historyRes = await fetch("/api/grns?mine=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (historyRes.ok) setGrnHistory(await historyRes.json());
    } catch (err: any) {
      setError(err.message || "GRN submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full text-slate-800">
      {/* Header */}
      <PageHeader
        title="Receive Goods Received Note (GRN)"
        description="Verify quantities, record physical conditions, note variances on inbound transfers, and update available stock."
      />

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition ${
            activeTab === "queue"
              ? "bg-primary text-white"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          Awaiting GRN ({transfers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition ${
            activeTab === "history"
              ? "bg-primary text-white"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          My GRN History ({grnHistory.length})
        </button>
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

      {/* Post-GRN document upload */}
      {submittedGrn && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-[#eff4ff] flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary" />
              Attach GRN Documents
              <span className="font-mono text-primary">{submittedGrn.referenceNumber}</span>
            </h2>
            <button
              onClick={() => setSubmittedGrn(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-200 rounded-lg transition"
            >
              Done
            </button>
          </div>
          <div className="p-6">
            <p className="text-xs text-slate-500 mb-4">
              Optionally attach the signed delivery note, condition report, or any supporting
              documents for this GRN.
            </p>
            <DocumentUpload
              transactionType="grn"
              transactionId={submittedGrn.grnId}
              canDelete={false}
              token={
                typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : ""
              }
            />
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
      ) : activeTab === "history" ? (
        grnHistory.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <p className="text-[#1E293B] font-extrabold text-base">No GRNs Submitted Yet</p>
            <p className="text-slate-450 text-xs mt-1 max-w-sm mx-auto">
              Completed goods receipt notes will stay here after submission.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                My Submitted GRNs
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {grnHistory.map((grn) => (
                <div key={grn.id} className="p-5 flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-black text-slate-900">
                        {grn.transfer_requests?.reference_number ?? grn.id}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {grn.transfer_requests?.sbus?.name ?? "Assigned SBU"} · Received {" "}
                        {new Date(grn.date_received).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                        grn.has_variance
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {grn.has_variance ? "Variance Reported" : "Completed"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {grn.grn_line_items.map((line) => (
                      <div
                        key={line.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <p className="font-bold text-slate-700">
                          {line.products?.name ?? "Product"}
                          {line.products?.sku && (
                            <span className="ml-1 font-mono text-[10px] text-slate-400">
                              ({line.products.sku})
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Issued {line.issued_quantity}, received {line.quantity_received}{" "}
                          {line.products?.unit_of_measure ?? "units"}
                        </p>
                      </div>
                    ))}
                  </div>
                  {grn.condition_notes && (
                    <p className="text-xs font-medium text-slate-500">
                      Notes: {grn.condition_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
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
                The following transfers have been successfully dispatched by unit staffs/operations
                and are awaiting arrival verification:
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
                          {/* <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                                Issued Qty
                              </label>
                              <input
                                type="number"
                                value={item.issued_quantity}
                                readOnly
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-100 font-mono text-slate-550 font-bold leading-normal"
                              />
                            </div> */}
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 leading-none">
                              Received Qty
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={item.quantity_received}
                              onChange={(e) =>
                                updateGRNItem(
                                  idx,
                                  "quantity_received",
                                  e.target.value === "" ? "" : Number(e.target.value),
                                )
                              }
                              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 font-extrabold focus:border-primary focus:outline-hidden leading-normal"
                            />
                          </div>
                          {/* <div>
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
                            </div> */}
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
                      disabled={submitting || !canVerifyGRN}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-lg transition shadow-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
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
  );
}
