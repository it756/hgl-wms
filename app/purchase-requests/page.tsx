"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Search, Eye, Send } from "lucide-react";

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

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [banner, setBanner] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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
                    <td className="px-4 py-3 text-slate-600">{r.sbus?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.supplier_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.purchase_request_line_items?.length ?? 0} item
                      {(r.purchase_request_line_items?.length ?? 0) !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.estimated_total != null
                        ? `KES ${r.estimated_total.toLocaleString()}`
                        : "—"}
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
                        <Link
                          href={`/purchase-requests/${r.id}`}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                          aria-label={`View purchase request ${r.reference_number}`}
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
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
    </DashboardLayout>
  );
}
