"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Plus,
  Search,
  Eye,
  Send,
  X,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

interface PurchaseRequest {
  id: string;
  reference_number: string;
  status: string;
  supplier_name: string | null;
  estimated_total: number | null;
  procurement_action: string | null;
  created_at: string;
  sbus: { name: string; code: string } | null;
  purchase_request_line_items: { product_name: string; quantity_requested: number }[];
}

interface LineItem {
  id: string;
  product_name: string;
  sku: string | null;
  quantity_requested: number;
  unit_of_measure: string;
  unit_cost: number | null;
  notes: string | null;
}

interface PurchaseRequestDetail {
  id: string;
  reference_number: string;
  status: string;
  supplier_name: string | null;
  notes: string | null;
  estimated_total: number | null;
  created_at: string;
  sbus: { name: string; code: string } | null;
  purchase_request_line_items: LineItem[];
  procurement_action: string | null;
  procurement_actioned_at: string | null;
  procurement_notes: string | null;
  procurement_document_url: string | null;
  internal_control_action: string | null;
  internal_control_actioned_at: string | null;
  internal_control_notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-500 border border-slate-200",
  PENDING_PROCUREMENT_APPROVAL: "bg-amber-50 text-amber-700 border border-amber-200",
  PROCUREMENT_CHANGES_REQUESTED: "bg-orange-50 text-orange-700 border border-orange-200",
  PENDING_INTERNAL_CONTROL_APPROVAL: "bg-blue-50 text-blue-700 border border-blue-200",
  INTERNAL_CONTROL_REJECTED: "bg-rose-50 text-rose-700 border border-rose-200",
  APPROVED_FOR_PURCHASE: "bg-teal-50 text-teal-700 border border-teal-200",
  EXPECTED_ORDER: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PARTIALLY_RECEIVED: "bg-purple-50 text-purple-700 border border-purple-200",
  RECEIVED: "bg-green-50 text-green-700 border border-green-200",
  CANCELLED: "bg-slate-100 text-slate-400 border border-slate-200",
  REJECTED: "bg-rose-100 text-rose-600 border border-rose-200",
};

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

// ─── Review card helper ─────────────────────────────────────────────
function ReviewCard({
  title,
  action,
  actionedAt,
  notes,
  docUrl,
}: {
  title: string;
  action: string | null;
  actionedAt: string | null;
  notes: string | null;
  docUrl: string | null;
}) {
  if (!action) return null;

  let icon = <AlertCircle className="w-4 h-4 text-slate-500" />;
  let colorClass = "bg-slate-50 border-slate-200 text-slate-700";
  if (action.includes("APPROVE") || action === "APPROVED") {
    icon = <CheckCircle className="w-4 h-4 text-emerald-500" />;
    colorClass = "bg-emerald-50 border-emerald-200 text-emerald-700";
  } else if (action.includes("REJECT") || action === "REJECTED") {
    icon = <XCircle className="w-4 h-4 text-rose-500" />;
    colorClass = "bg-rose-50 border-rose-200 text-rose-700";
  } else if (action.includes("CHANGES")) {
    icon = <Clock className="w-4 h-4 text-amber-500" />;
    colorClass = "bg-amber-50 border-amber-200 text-amber-700";
  }

  return (
    <div className={`rounded-lg border p-4 space-y-2 text-sm ${colorClass}`}>
      <p className="font-semibold">{title}</p>
      <div className="flex items-center gap-2">
        {icon}
        <span>
          {action.replace(/_/g, " ")}
          {actionedAt && ` Â· ${new Date(actionedAt).toLocaleString()}`}
        </span>
      </div>
      {notes && <p className="pl-6 opacity-80">Notes: {notes}</p>}
      {docUrl && /^https?:\/\//i.test(docUrl) && (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pl-6 inline-flex items-center gap-1 underline underline-offset-2"
        >
          <FileText className="w-3.5 h-3.5" />
          View Document
        </a>
      )}
    </div>
  );
}

// ─── Detail dialog ───────────────────────────────────────────────────
function PRDetailDialog({
  pr,
  loading,
  onClose,
}: {
  pr: PurchaseRequestDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* panel */}
      <div className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            {loading || !pr ? (
              <div className="h-5 w-48 bg-slate-200 animate-pulse rounded" />
            ) : (
              <>
                <p className="font-mono text-sm text-slate-500">{pr.reference_number}</p>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">
                  Purchase Request Details
                </h2>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading || !pr ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-24 bg-slate-200 rounded" />
              <div className="h-40 bg-slate-200 rounded" />
            </div>
          ) : (
            <>
              {/* status + meta */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[pr.status] ?? "bg-slate-100 text-slate-500"}`}
                >
                  {STATUS_LABELS[pr.status] ?? pr.status}
                </span>
                <span className="text-xs text-slate-400">
                  Created {new Date(pr.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* primary details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">SBU</p>
                  <p className="text-slate-800">{pr.sbus?.name ?? "â€”"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Supplier</p>
                  <p className="text-slate-800">{pr.supplier_name ?? "â€”"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">
                    Estimated Total
                  </p>
                  <p className="text-slate-800 font-semibold">
                    {pr.estimated_total != null
                      ? `ZMW ${pr.estimated_total.toLocaleString()}`
                      : "â€”"}
                  </p>
                </div>
              </div>

              {pr.notes && (
                <div className="text-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Notes</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{pr.notes}</p>
                </div>
              )}

              {/* review stages */}
              {(pr.procurement_action || pr.internal_control_action) && (
                <div className="space-y-3">
                  <ReviewCard
                    title="Procurement Review"
                    action={pr.procurement_action}
                    actionedAt={pr.procurement_actioned_at}
                    notes={pr.procurement_notes}
                    docUrl={pr.procurement_document_url}
                  />
                  <ReviewCard
                    title="Internal Control Review"
                    action={pr.internal_control_action}
                    actionedAt={pr.internal_control_actioned_at}
                    notes={pr.internal_control_notes}
                    docUrl={null}
                  />
                </div>
              )}

              {/* line items */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Requested Items ({pr.purchase_request_line_items.length})
                </p>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Cost</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pr.purchase_request_line_items.map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-slate-800">{l.product_name}</p>
                            {l.sku && <p className="text-xs text-slate-400">SKU: {l.sku}</p>}
                            {l.notes && (
                              <p className="text-xs italic text-slate-400 mt-0.5">{l.notes}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600">
                            {l.quantity_requested} {l.unit_of_measure}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600">
                            {l.unit_cost != null ? `ZMW ${l.unit_cost.toLocaleString()}` : "â€”"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                            {l.unit_cost != null
                              ? `ZMW ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                              : "â€”"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function PurchaseRequestsPage() {
  return (
    <Suspense>
      <PurchaseRequestsContent />
    </Suspense>
  );
}

function PurchaseRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const created = searchParams.get("created");
  const submitted = searchParams.get("submitted");
  const viewId = searchParams.get("view");

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [banner, setBanner] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPr, setDialogPr] = useState<PurchaseRequestDetail | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    if (created) {
      setBanner(
        submitted === "true"
          ? `Purchase request ${created} submitted to procurement.`
          : `Purchase request ${created} saved as draft.`,
      );
    }
  }, [created, submitted]);

  useEffect(() => {
    fetchRequests();
  }, []);

  // Open dialog when ?view= is in the URL (e.g. redirect from [id] page)
  useEffect(() => {
    if (viewId && !dialogOpen) {
      openDialog(viewId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/purchase-requests", {
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

  async function openDialog(id: string) {
    setDialogPr(null);
    setDialogLoading(true);
    setDialogOpen(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/purchase-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setDialogPr(data as PurchaseRequestDetail);
    } catch {
      setDialogOpen(false);
    } finally {
      setDialogLoading(false);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setDialogPr(null);
    // Remove ?view= from URL without navigation
    if (searchParams.get("view")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      router.replace(url.pathname + (url.search !== "?" ? url.search : ""), { scroll: false });
    }
  }

  async function handleSubmit(id: string, reference: string) {
    setSubmittingId(id);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/purchase-requests/${id}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setBanner(
        `${reference} submitted to procurement. They will receive an email with a review link.`,
      );
      fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmittingId(null);
    }
  }

  const filtered = requests.filter((r) => {
    const matchesSearch =
      !search ||
      r.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Purchase Requests</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage external purchase requests and procurement approvals
            </p>
          </div>
          <Link
            href="/purchase-requests/new"
            className="bg-primary hover:bg-primary/95 text-white rounded-lg px-5 py-2.5 text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:shadow-md cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Link>
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by reference or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading purchase requests…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No purchase requests found.{" "}
            <Link href="/purchase-requests/new" className="text-blue-600 hover:underline">
              Create one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">SBU</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-right">Est. Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {r.reference_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.sbus?.name ?? "â€”"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.supplier_name ?? "â€”"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.purchase_request_line_items?.length ?? 0} item
                      {(r.purchase_request_line_items?.length ?? 0) !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.estimated_total != null
                        ? `ZMW ${r.estimated_total.toLocaleString()}`
                        : "â€”"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDialog(r.id)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                          aria-label={`View purchase request ${r.reference_number}`}
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(r.status === "DRAFT" || r.status === "PROCUREMENT_CHANGES_REQUESTED") && (
                          <button
                            onClick={() => handleSubmit(r.id, r.reference_number)}
                            disabled={submittingId === r.id}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-40"
                            aria-label={`Submit ${r.reference_number} to procurement`}
                            title="Submit to Procurement"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      {dialogOpen && (
        <PRDetailDialog pr={dialogPr} loading={dialogLoading} onClose={closeDialog} />
      )}
    </DashboardLayout>
  );
}


