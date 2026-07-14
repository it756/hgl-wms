"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import IconButton from "@/components/IconButton";
import HScrollArea from "@/components/HScrollArea";
import DashboardLayout from "@/components/DashboardLayout";
import { Table, TableHead, Td, Th, Tr } from "@/components/Table";
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
  Pencil,
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

// --- Review card helper ---------------------------------------------
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
          {actionedAt && ` — ${new Date(actionedAt).toLocaleString()}`}
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

// --- Detail dialog ---------------------------------------------------
function PRDetailDialog({
  pr,
  loading,
  token,
  onClose,
}: {
  pr: PurchaseRequestDetail | null;
  loading: boolean;
  token: string | null;
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
                  <p className="text-slate-800">{pr.sbus?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">Supplier</p>
                  <p className="text-slate-800">{pr.supplier_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-0.5">
                    Estimated Total
                  </p>
                  <p className="text-slate-800 font-semibold">
                    {pr.estimated_total != null
                      ? `ZMW ${pr.estimated_total.toLocaleString()}`
                      : "—"}
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

              {token && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase">
                    Procurement Documents
                  </p>
                  <DocumentUpload
                    transactionType="purchase_request"
                    transactionId={pr.id}
                    token={token}
                    canDelete={false}
                    readOnly
                  />
                </div>
              )}

              {/* line items */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Requested Items ({pr.purchase_request_line_items.length})
                </p>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
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
                        Total
                      </Th>
                    </TableHead>
                    <tbody className="divide-y divide-slate-100">
                      {pr.purchase_request_line_items.map((l) => (
                        <Tr key={l.id}>
                          <Td className="px-3 py-2.5">
                            <p className="font-medium text-slate-800">{l.product_name}</p>
                            {l.sku && <p className="text-xs text-slate-400">SKU: {l.sku}</p>}
                            {l.notes && (
                              <p className="text-xs italic text-slate-400 mt-0.5">{l.notes}</p>
                            )}
                          </Td>
                          <Td align="center" className="px-3 py-2.5 text-slate-600">
                            {l.quantity_requested} {l.unit_of_measure}
                          </Td>
                          <Td align="right" className="px-3 py-2.5 text-slate-600">
                            {l.unit_cost != null ? `ZMW ${l.unit_cost.toLocaleString()}` : "—"}
                          </Td>
                          <Td align="right" className="px-3 py-2.5 font-medium text-slate-800">
                            {l.unit_cost != null
                              ? `ZMW ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                              : "—"}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main page ----------------------------------------------------------------
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
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPr, setDialogPr] = useState<PurchaseRequestDetail | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const urlBanner = created
    ? submitted === "true"
      ? `Purchase request ${created} submitted to procurement.`
      : `Purchase request ${created} saved as draft.`
    : null;
  const visibleBanner = banner ?? urlBanner;

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
      setAuthToken(token);
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
      setAuthToken(token);
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

      {visibleBanner && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-lg px-4 py-3 text-sm">
          {visibleBanner}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

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
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
          <HScrollArea>
            <Table className="min-w-full divide-y divide-slate-100 text-xs">
              <TableHead>
                <Th className="px-4 py-3">Reference</Th>
                <Th className="px-4 py-3">SBU</Th>
                <Th className="px-4 py-3">Supplier</Th>
                <Th className="px-4 py-3">Items</Th>
                <Th align="right" className="px-4 py-3">
                  Est. Total
                </Th>
                <Th className="px-4 py-3">Status</Th>
                <Th className="px-4 py-3">Created</Th>
                <Th align="center" className="px-4 py-3">
                  Actions
                </Th>
              </TableHead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <Tr key={r.id}>
                    <Td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {r.reference_number}
                    </Td>
                    <Td className="px-4 py-3 text-slate-600">{r.sbus?.name ?? "—"}</Td>
                    <Td
                      className="px-4 py-3 text-slate-600 max-w-45 truncate"
                      title={r.supplier_name ?? "—"}
                    >
                      {r.supplier_name ?? "—"}
                    </Td>
                    <Td className="px-4 py-3 text-slate-500">
                      {r.purchase_request_line_items?.length ?? 0} item
                      {(r.purchase_request_line_items?.length ?? 0) !== 1 ? "s" : ""}
                    </Td>
                    <Td align="right" className="px-4 py-3 text-slate-700">
                      {r.estimated_total != null
                        ? `ZMW ${r.estimated_total.toLocaleString()}`
                        : "—"}
                    </Td>
                    <Td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </Td>
                    <Td className="px-4 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </Td>
                    <Td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconButton
                          icon={<Eye className="w-3.5 h-3.5" />}
                          label={`View purchase request ${r.reference_number}`}
                          href={`/purchase-requests/${r.id}`}
                        />
                        {(r.status === "DRAFT" || r.status === "PROCUREMENT_CHANGES_REQUESTED") && (
                          <>
                            <Link
                              href={`/purchase-requests/new?edit=${r.id}`}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors"
                              aria-label={`Edit purchase request ${r.reference_number}`}
                              title="Edit request"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleSubmit(r.id, r.reference_number)}
                              disabled={submittingId === r.id}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-40"
                              aria-label={`Submit ${r.reference_number} to procurement`}
                              title={
                                r.status === "PROCUREMENT_CHANGES_REQUESTED"
                                  ? "Resubmit to Procurement"
                                  : "Submit to Procurement"
                              }
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </HScrollArea>
        </div>
      )}
      </div>

      {/* Detail dialog */}
      {dialogOpen && (
        <PRDetailDialog
          pr={dialogPr}
          loading={dialogLoading}
          token={authToken}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
