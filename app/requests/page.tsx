"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  Search,
  Plus,
  Calendar,
  Filter,
  Eye,
  XCircle,
  ArrowLeftRight,
  RefreshCw,
} from "lucide-react";

interface TransferRequest {
  id: string;
  reference_number: string;
  status: string;
  required_date: string | null;
  created_at: string;
  estimated_value: number | null;
  requires_finance_approval: boolean;
  sbu_units: { id: string; name: string; code: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_BU_APPROVAL: "bg-amber-50 text-amber-700 border border-amber-200",
  PENDING: "bg-slate-100 text-slate-500 border border-slate-200",
  PENDING_APPROVAL: "bg-orange-50 text-orange-700 border border-orange-200",
  APPROVED_FOR_ISSUE: "bg-blue-50 text-sky-700 border border-blue-200",
  ISSUED: "bg-purple-50 text-purple-700 border border-purple-200",
  COMPLETED: "bg-teal-50 text-emerald-700 border border-teal-200",
  COMPLETED_WITH_VARIANCE: "bg-red-50 text-rose-700 border border-red-200",
  CANCELLED: "bg-slate-100 text-slate-400 border border-slate-200",
};

export default function RequestsListPage() {
  return (
    <Suspense>
      <RequestsListContent />
    </Suspense>
  );
}

function RequestsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const created = searchParams.get("created");

  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters state
  const [searchRef, setSearchRef] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    async function fetchRequests() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/transfer-requests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load requests");
        setRequests(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    const matchesRef = r.reference_number?.toLowerCase().includes(searchRef.toLowerCase());
    const matchesStatus =
      statusFilter === "All" || r.status.toUpperCase() === statusFilter.toUpperCase();
    return matchesRef && matchesStatus;
  });
  const { currency, rate, fetching: rateFetching, rateError, toggleCurrency, fmt } = useCurrency();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Page Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-primary font-bold">Transfer Requests</span>
            </div>
            <h1 className="text-2xl font-extrabold text-on-surface">My Transfer Requests</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage and track internal warehouse inventory transfers across SBUs.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCurrency}
                disabled={rateFetching}
                title={currency === "ZMW" ? "Convert display to USD" : "Switch back to ZMW"}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60"
              >
                {rateFetching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                )}
                {rateFetching
                  ? "Fetching rate…"
                  : currency === "ZMW"
                    ? "View in USD"
                    : "View in ZMW"}
              </button>
              <Link
                href="/requests/new"
                className="bg-primary hover:bg-primary/95 text-white rounded-lg px-5 py-2.5 text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:shadow-md cursor-pointer active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                New Request
              </Link>
            </div>
            {currency === "USD" && rate != null && (
              <a
                href="https://open.er-api.com/v6/latest/ZMW"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-primary/70 hover:text-primary hover:underline transition-colors"
              >
                1 ZMW = ${rate.toFixed(6)} USD · open.er-api.com
              </a>
            )}
          </div>
        </div>

        {created && (
          <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-lg px-4 py-3 text-xs font-semibold animate-pulse">
            Transfer request <strong>{created}</strong> submitted successfully.
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-xs font-semibold">
            {error}
          </div>
        )}
        {rateError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-xs font-semibold">
            {rateError}
          </div>
        )}

        {/* Filter Bar Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 flex flex-wrap items-center gap-4 shadow-sm">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Search by Reference
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
              <input
                className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline-variant"
                placeholder="e.g. TR-2023-001"
                type="text"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
              />
            </div>
          </div>
          <div className="w-52">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Status
            </label>
            <select
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="PENDING_BU_APPROVAL">Pending BU Approval</option>
              <option value="Pending">Pending</option>
              <option value="Pending_Approval">Pending Finance Approval</option>
              <option value="Approved_For_Issue">Approved</option>
              <option value="Issued">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end h-full pt-5">
            <button
              onClick={() => {
                setSearchRef("");
                setStatusFilter("All");
              }}
              className="text-primary font-bold text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 hover:underline transition-all cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Data Table Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></span>
              <p className="text-xs font-bold font-mono">LOADING REQUESTS...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-16 text-center text-slate-500 font-semibold text-sm">
              No matching transfer requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-[#eff4ff] border-b border-outline-variant">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Required Date
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Est. Value
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Date Raised
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-primary font-mono text-sm leading-none">
                          {r.reference_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                        {r.sbu_units ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {r.sbu_units.code}
                            </span>
                            <span>{r.sbu_units.name}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600 border border-slate-200"}`}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                        {r.requires_finance_approval && (
                          <span className="ml-1.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            Finance
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                        {r.required_date
                          ? new Date(r.required_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-bold text-slate-600">
                        {fmt(r.estimated_value)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-400">
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                            title="View Details"
                            onClick={() => router.push(`/requests/${r.id}`)}
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
