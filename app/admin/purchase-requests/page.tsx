"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, FileText } from "lucide-react";

interface PurchaseRequest {
  id: string;
  reference_number: string;
  status: string;
  supplier_name: string | null;
  procurement_email: string;
  estimated_total: number | null;
  procurement_action: string | null;
  procurement_notes: string | null;
  procurement_actioned_at: string | null;
  procurement_document_url: string | null;
  notes: string | null;
  created_at: string;
  sbus: { name: string; code: string } | null;
  purchase_request_line_items: {
    id: string;
    product_name: string;
    sku: string | null;
    quantity_requested: number;
    unit_of_measure: string;
    unit_cost: number | null;
  }[];
}

export default function AdminPurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        "/api/admin/purchase-requests?status=PENDING_INTERNAL_CONTROL_APPROVAL",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load queue");
      setRequests(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setActioning(id);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/admin/purchase-requests/${id}/internal-control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, notes: actionNotes[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      const req = requests.find((r) => r.id === id);
      const label = action === "approve" ? "approved" : "rejected";
      setBanner(`${req?.reference_number} has been ${label}.`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setExpanded(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActioning(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Internal Control — Purchase Requests
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review purchase requests approved by procurement and apply internal control approval.
          </p>
        </div>

        {banner && (
          <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-lg px-4 py-3 text-sm">
            {banner}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading queue…</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No purchase requests pending internal control review.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Header row */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-semibold text-slate-700">
                      {r.reference_number}
                    </span>
                    <span className="text-sm text-slate-500">{r.sbus?.name ?? "Unknown SBU"}</span>
                    {r.supplier_name && (
                      <span className="text-sm text-slate-400">{r.supplier_name}</span>
                    )}
                    {r.estimated_total != null && (
                      <span className="text-sm font-medium text-slate-600">
                        KES {r.estimated_total.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    {expanded === r.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === r.id && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                    {/* Procurement outcome */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm space-y-1">
                      <p className="font-medium text-blue-700">Procurement Review</p>
                      <p className="text-blue-600">
                        Action: <strong>{r.procurement_action}</strong>
                        {r.procurement_actioned_at &&
                          ` on ${new Date(r.procurement_actioned_at).toLocaleString()}`}
                      </p>
                      {r.procurement_notes && (
                        <p className="text-blue-600">Notes: {r.procurement_notes}</p>
                      )}
                      {r.procurement_document_url && (
                        <a
                          href={r.procurement_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Procurement Document
                        </a>
                      )}
                    </div>

                    {/* Line items */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                        Requested Items
                      </p>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2 text-right">Unit Cost</th>
                            <th className="px-3 py-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {r.purchase_request_line_items.map((l) => (
                            <tr key={l.id}>
                              <td className="px-3 py-2">
                                {l.product_name}
                                {l.sku && (
                                  <span className="ml-1 text-slate-400 text-xs">({l.sku})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {l.quantity_requested} {l.unit_of_measure}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {l.unit_cost != null ? `KES ${l.unit_cost.toLocaleString()}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {l.unit_cost != null
                                  ? `KES ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {r.notes && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">SBU Notes:</span> {r.notes}
                      </p>
                    )}

                    {/* Action area */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block text-sm font-medium text-slate-700">
                        Internal Control Notes (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={actionNotes[r.id] ?? ""}
                        onChange={(e) =>
                          setActionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        placeholder="Add notes for this decision…"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleAction(r.id, "approve")}
                          disabled={actioning === r.id}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {actioning === r.id ? "Processing…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(r.id, "reject")}
                          disabled={actioning === r.id}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
