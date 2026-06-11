"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  TrendingDown,
  Package,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  unit_of_measure: string;
  unit_cost: number | null;
}

interface GRNLineItem {
  id: string;
  product_id: string;
  issued_quantity: number;
  quantity_received: number;
  variance_notes: string | null;
  products: ProductRow;
}

interface GRNRow {
  id: string;
  has_variance: boolean;
  condition_notes: string | null;
  date_received: string;
  grn_line_items: GRNLineItem[];
}

interface VarianceTransfer {
  id: string;
  reference_number: string;
  sbu_id: string;
  notes: string | null;
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
  sbus: { id: string; name: string; code: string } | null;
  grns: GRNRow[];
}

type DispositionType = "WRITE_BACK" | "LOSS" | null;

interface LineState {
  disposition: DispositionType;
  notes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dp = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BUVariancePage() {
  const [transfers, setTransfers] = useState<VarianceTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded state per transfer
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Per-transfer line dispositions: { [transferId]: { [lineItemId]: LineState } }
  const [dispositions, setDispositions] = useState<Record<string, Record<string, LineState>>>({});

  // Submission state per transfer
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bu/variance", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);

      const list: VarianceTransfer[] = data;
      setTransfers(list);

      // Initialise disposition state for each variance line
      const init: Record<string, Record<string, LineState>> = {};
      for (const tr of list) {
        init[tr.id] = {};
        for (const grn of tr.grns ?? []) {
          for (const li of grn.grn_line_items ?? []) {
            const variance = li.issued_quantity - li.quantity_received;
            if (variance > 0) {
              init[tr.id][li.id] = { disposition: null, notes: "" };
            }
          }
        }
      }
      setDispositions(init);

      // Auto-expand if only one transfer
      if (list.length === 1) {
        setExpanded({ [list[0].id]: true });
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load variance transfers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function setLineDisposition(transferId: string, lineId: string, d: DispositionType) {
    setDispositions((prev) => ({
      ...prev,
      [transferId]: {
        ...prev[transferId],
        [lineId]: { ...prev[transferId][lineId], disposition: d },
      },
    }));
  }

  function setLineNotes(transferId: string, lineId: string, notes: string) {
    setDispositions((prev) => ({
      ...prev,
      [transferId]: {
        ...prev[transferId],
        [lineId]: { ...prev[transferId][lineId], notes },
      },
    }));
  }

  function isTransferComplete(transfer: VarianceTransfer): boolean {
    const lineStates = dispositions[transfer.id] ?? {};
    const lines = Object.values(lineStates);
    return lines.length > 0 && lines.every((l) => l.disposition !== null);
  }

  async function handleSubmit(transfer: VarianceTransfer) {
    setSubmitError((prev) => ({ ...prev, [transfer.id]: "" }));
    setSubmitting(transfer.id);

    const lineStates = dispositions[transfer.id] ?? {};
    const line_dispositions = Object.entries(lineStates).map(([grn_line_item_id, state]) => ({
      grn_line_item_id,
      disposition: state.disposition,
      notes: state.notes || undefined,
    }));

    try {
      const res = await fetch(`/api/bu/variance/${transfer.id}/disposition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ line_dispositions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);

      setSubmitted((prev) => ({ ...prev, [transfer.id]: true }));
      // Remove from list after a short delay
      setTimeout(() => {
        setTransfers((prev) => prev.filter((t) => t.id !== transfer.id));
      }, 1800);
    } catch (e: any) {
      setSubmitError((prev) => ({
        ...prev,
        [transfer.id]: e.message ?? "Submission failed",
      }));
    } finally {
      setSubmitting(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-slate-800">Variance Decisions</h1>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            Review transfers where goods arrived short. Decide per item whether to write stock back
            to the warehouse or record it as a loss.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading variance transfers…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && transfers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-400" />
            <p className="font-semibold text-slate-600">No pending variance decisions</p>
            <p className="text-sm mt-1">All transfers have been reviewed.</p>
          </div>
        )}

        {/* Transfer cards */}
        {!loading &&
          transfers.map((transfer) => {
            const isOpen = expanded[transfer.id] ?? false;
            const isComplete = isTransferComplete(transfer);
            const isSubmitting = submitting === transfer.id;
            const isSubmitted = submitted[transfer.id] ?? false;
            const errMsg = submitError[transfer.id] ?? "";

            // Collect variance lines across all GRNs
            const varianceLines: { grn: GRNRow; li: GRNLineItem }[] = [];
            for (const grn of transfer.grns ?? []) {
              for (const li of grn.grn_line_items ?? []) {
                if (li.issued_quantity - li.quantity_received > 0) {
                  varianceLines.push({ grn, li });
                }
              }
            }

            return (
              <div
                key={transfer.id}
                className={`mb-4 rounded-xl border transition-all ${
                  isSubmitted
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-white shadow-sm"
                }`}
              >
                {/* Card header */}
                <button
                  onClick={() => toggleExpand(transfer.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-4">
                    {isSubmitted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">{transfer.reference_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {transfer.sbus?.name ?? transfer.sbu_id} · {fmtDate(transfer.updated_at)} ·{" "}
                        <span className="font-medium text-amber-600">
                          {varianceLines.length} variance{varianceLines.length !== 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isComplete && !isSubmitted && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        Ready to submit
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Submitted confirmation */}
                {isSubmitted && (
                  <div className="px-5 pb-5 text-sm text-emerald-700 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Disposition submitted successfully — transfer marked COMPLETED.
                  </div>
                )}

                {/* Expanded content */}
                {isOpen && !isSubmitted && (
                  <div className="px-5 pb-5 border-t border-slate-100">
                    {/* GRN info */}
                    {transfer.grns?.[0] && (
                      <div className="mt-4 mb-5 text-xs text-slate-500 flex gap-6">
                        <span>
                          GRN received: <strong>{fmtDate(transfer.grns[0].date_received)}</strong>
                        </span>
                        {transfer.grns[0].condition_notes && (
                          <span>
                            Condition notes:{" "}
                            <em className="text-slate-600">{transfer.grns[0].condition_notes}</em>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Line items */}
                    <div className="space-y-4">
                      {varianceLines.map(({ li }) => {
                        const variance = li.issued_quantity - li.quantity_received;
                        const state = dispositions[transfer.id]?.[li.id];
                        const valueAtRisk =
                          li.products.unit_cost != null ? variance * li.products.unit_cost : null;

                        return (
                          <div
                            key={li.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                          >
                            {/* Product info row */}
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-start gap-3">
                                <Package className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-semibold text-slate-800 text-sm">
                                    {li.products.name}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {li.products.sku} · {li.products.unit_of_measure}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs text-slate-500">
                                  Issued:{" "}
                                  <span className="font-semibold text-slate-700">
                                    {li.issued_quantity}
                                  </span>{" "}
                                  · Received:{" "}
                                  <span className="font-semibold text-slate-700">
                                    {li.quantity_received}
                                  </span>
                                </p>
                                <p className="text-sm font-bold text-amber-600 mt-0.5">
                                  Variance: {variance} {li.products.unit_of_measure}
                                  {valueAtRisk != null && (
                                    <span className="ml-2 text-xs font-semibold text-slate-500">
                                      (≈ ${fmt(valueAtRisk)})
                                    </span>
                                  )}
                                </p>
                                {li.variance_notes && (
                                  <p className="text-xs text-rose-500 mt-1 italic">
                                    {li.variance_notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Disposition toggle */}
                            <div className="flex gap-3 mb-3">
                              <button
                                onClick={() =>
                                  setLineDisposition(
                                    transfer.id,
                                    li.id,
                                    state?.disposition === "WRITE_BACK" ? null : "WRITE_BACK",
                                  )
                                }
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                  state?.disposition === "WRITE_BACK"
                                    ? "bg-emerald-500 border-emerald-500 text-white shadow"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                                }`}
                              >
                                <RotateCcw className="w-4 h-4" />
                                Write Back to Warehouse
                              </button>
                              <button
                                onClick={() =>
                                  setLineDisposition(
                                    transfer.id,
                                    li.id,
                                    state?.disposition === "LOSS" ? null : "LOSS",
                                  )
                                }
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                  state?.disposition === "LOSS"
                                    ? "bg-rose-500 border-rose-500 text-white shadow"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700"
                                }`}
                              >
                                <TrendingDown className="w-4 h-4" />
                                Record as Loss
                              </button>
                            </div>

                            {/* Disposition context messages */}
                            {state?.disposition === "WRITE_BACK" && (
                              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2 mb-3">
                                {variance} {li.products.unit_of_measure} will be credited back to
                                warehouse stock.
                              </p>
                            )}
                            {state?.disposition === "LOSS" && (
                              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded px-3 py-2 mb-3">
                                {variance} {li.products.unit_of_measure} will be posted to the Loss
                                Account
                                {valueAtRisk != null ? ` (value: $${fmt(valueAtRisk)})` : ""}. Stock
                                will not be credited back.
                              </p>
                            )}

                            {/* Notes textarea */}
                            {state?.disposition && (
                              <textarea
                                rows={2}
                                value={state.notes}
                                onChange={(e) => setLineNotes(transfer.id, li.id, e.target.value)}
                                placeholder={
                                  state.disposition === "WRITE_BACK"
                                    ? "Reason for write-back (optional)…"
                                    : "Loss reason / details (optional)…"
                                }
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit section */}
                    <div className="mt-5 flex items-center justify-between gap-4">
                      <div className="text-xs text-slate-500">
                        {
                          Object.values(dispositions[transfer.id] ?? {}).filter(
                            (s) => s.disposition !== null,
                          ).length
                        }{" "}
                        of {varianceLines.length} lines decided
                      </div>
                      <div className="flex items-center gap-3">
                        {errMsg && <p className="text-xs text-rose-600 font-medium">{errMsg}</p>}
                        <button
                          onClick={() => handleSubmit(transfer)}
                          disabled={!isComplete || isSubmitting}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            isComplete && !isSubmitting
                              ? "bg-primary text-white hover:bg-primary/90 shadow"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Submitting…
                            </>
                          ) : (
                            <>
                              Submit Disposition
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </DashboardLayout>
  );
}
