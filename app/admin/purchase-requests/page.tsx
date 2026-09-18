"use client";

import { useEffect, useState } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import { Table, TableHead, Td, Th, Tr } from "@/components/Table";
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
  internal_control_action: string | null;
  internal_control_notes: string | null;
  internal_control_actioned_at: string | null;
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

const PENDING_STATUS = "PENDING_INTERNAL_CONTROL_APPROVAL";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_PROCUREMENT_APPROVAL: "Awaiting Procurement",
  PROCUREMENT_CHANGES_REQUESTED: "Changes Requested",
  PENDING_INTERNAL_CONTROL_APPROVAL: "Awaiting Internal Control",
  INTERNAL_CONTROL_REJECTED: "Rejected (Internal Control)",
  APPROVED_FOR_PURCHASE: "Approved",
  EXPECTED_ORDER: "Expected Order",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_INTERNAL_CONTROL_APPROVAL: "bg-blue-50 text-blue-700 border-blue-200",
  INTERNAL_CONTROL_REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  EXPECTED_ORDER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIALLY_RECEIVED: "bg-purple-50 text-purple-700 border-purple-200",
  RECEIVED: "bg-green-50 text-green-700 border-green-200",
};

export default function AdminPurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [actioning, setActioning] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token");
      setAuthToken(token);
      const res = await fetch("/api/admin/purchase-requests?scope=all&limit=200", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load purchase requests");
      setRequests(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchRequests);
  }, []);

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
      await fetchRequests();
      setExpanded(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActioning(null);
    }
  }

  const queueRequests = requests.filter((r) => r.status === PENDING_STATUS);
  const historyStatuses = Array.from(new Set(requests.map((r) => r.status)));
  const visibleRequests = (activeTab === "queue" ? queueRequests : requests).filter((r) => {
    const matchesSearch =
      !search ||
      r.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.sbus?.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = activeTab === "queue" || statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Internal Control — Purchase Requests</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Review pending purchase requests and keep a searchable history of internal control outcomes.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "queue"
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pending Review ({queueRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "history"
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All History ({requests.length})
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, SBU, or supplier..."
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {activeTab === "history" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              {historyStatuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] ?? status}
                </option>
              ))}
            </select>
          )}
        </div>
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
        <div className="text-center py-12 text-slate-500 text-sm">Loading purchase requests…</div>
      ) : visibleRequests.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {activeTab === "queue"
            ? "No purchase requests pending internal control review."
            : "No purchase requests match this history view."}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                aria-expanded={expanded === r.id}
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
                      ZMW {r.estimated_total.toLocaleString()}
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[r.status] ?? "border-slate-200 bg-slate-100 text-slate-500"}`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
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
              </button>

              {expanded === r.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm space-y-1">
                    <p className="font-medium text-blue-700">Procurement Review</p>
                    <p className="text-blue-600">
                      Action: <strong>{r.procurement_action ?? "Pending"}</strong>
                      {r.procurement_actioned_at &&
                        ` on ${new Date(r.procurement_actioned_at).toLocaleString()}`}
                    </p>
                    {r.procurement_notes && (
                      <p className="text-blue-600">Notes: {r.procurement_notes}</p>
                    )}
                    {r.procurement_document_url &&
                      /^https?:\/\//i.test(r.procurement_document_url) && (
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
                    {authToken && (
                      <div className="pt-2">
                        <p className="text-xs font-semibold uppercase text-blue-500 mb-2">
                          Procurement Documents
                        </p>
                        <DocumentUpload
                          transactionType="purchase_request"
                          transactionId={r.id}
                          token={authToken}
                          canDelete={false}
                          readOnly
                        />
                      </div>
                    )}
                  </div>

                  {r.status !== PENDING_STATUS && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p className="font-medium text-slate-700">Internal Control Outcome</p>
                      <p>
                        {r.internal_control_action?.replace(/_/g, " ") ??
                          "No internal control action recorded"}
                        {r.internal_control_actioned_at &&
                          ` on ${new Date(r.internal_control_actioned_at).toLocaleString()}`}
                      </p>
                      {r.internal_control_notes && <p>Notes: {r.internal_control_notes}</p>}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                      Requested Items
                    </p>
                    <Table>
                      <TableHead>
                        <Th className="px-3 py-2">Item</Th>
                        <Th align="center" className="px-3 py-2">
                          Qty
                        </Th>
                        <Th align="right" className="px-3 py-2">
                          Unit Cost
                        </Th>
                        <Th align="right" className="px-3 py-2">
                          Line Total
                        </Th>
                      </TableHead>
                      <tbody className="divide-y divide-slate-100">
                        {r.purchase_request_line_items.map((l) => (
                          <Tr key={l.id}>
                            <Td className="px-3 py-2">
                              {l.product_name}
                              {l.sku && (
                                <span className="ml-1 text-slate-400 text-xs">({l.sku})</span>
                              )}
                            </Td>
                            <Td align="center" className="px-3 py-2">
                              {l.quantity_requested} {l.unit_of_measure}
                            </Td>
                            <Td align="right" className="px-3 py-2">
                              {l.unit_cost != null ? `ZMW ${l.unit_cost.toLocaleString()}` : "—"}
                            </Td>
                            <Td align="right" className="px-3 py-2 font-medium">
                              {l.unit_cost != null
                                ? `ZMW ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                                : "—"}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>

                  {r.notes && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">SBU Notes:</span> {r.notes}
                    </p>
                  )}

                  {r.status === PENDING_STATUS && (
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
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
