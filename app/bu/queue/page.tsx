"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  X,
  ShieldAlert,
  BarChart3,
  Search,
  ArrowRightLeft,
  RefreshCw,
  ArrowLeftRight,
  Calendar,
  Building,
  ChevronRight,
  Layers,
} from "lucide-react";

interface PendingRequest {
  id: string;
  reference_number: string;
  status: string;
  estimated_value?: number;
  created_at: string;
  required_date?: string;
  notes?: string;
  sbu_name?: string;
  unit_name?: string;
  unit_code?: string;
  items?: Array<{
    name: string;
    sku: string;
    quantity: number;
    unit_cost?: number;
    total?: number;
  }>;
}

export default function BuApprovalQueuePage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<PendingRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [approvedToday, setApprovedToday] = useState(0);
  const [rejectedToday, setRejectedToday] = useState(0);
  const { currency, rate, fetching: rateFetching, rateError, toggleCurrency, fmt } = useCurrency();

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch("/api/bu/approvals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load approvals queue");

      const normalized = (data.transfer_requests ?? []).map((t: any) => ({
        ...t,
        sbu_name: t.sbus?.name ?? t.sbu_id,
        unit_name: t.sbu_units?.name ?? null,
        unit_code: t.sbu_units?.code ?? null,
        items: (t.transfer_line_items ?? []).map((l: any) => ({
          name: l.products?.name ?? `Product ${l.product_id}`,
          sku: l.products?.sku ?? "",
          quantity: l.requested_quantity,
          unit_cost: l.products?.unit_cost ?? null,
          total: l.requested_quantity * (l.products?.unit_cost ?? 0),
        })),
      }));

      setRequests(normalized);
      setApprovedToday(data.approved_today ?? 0);
      setRejectedToday(data.rejected_today ?? 0);
    } catch (err: any) {
      setError(err.message || "Failed to load approvals queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleAction(requestId: string, action: "approve" | "reject") {
    setError(null);
    setSuccess(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch("/api/bu/approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transfer_request_id: requestId,
          action,
          notes: notes[requestId] ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setSuccess(
        `Transfer request ${action === "approve" ? "approved and forwarded to Finance" : "rejected"} successfully.`,
      );
      setNotes((prev) => {
        const copy = { ...prev };
        delete copy[requestId];
        return copy;
      });
      setSelectedItem(null);
      await loadQueue();
    } catch (err: any) {
      setError(err.message || "Action failed. Please try again.");
    }
  }

  const filtered = requests.filter(
    (r) =>
      r.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.unit_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sbu_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const pendingValue = requests.reduce((sum, r) => sum + (r.estimated_value || 0), 0);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-850">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Operations</span>
              <span className="text-slate-300">/</span>
              <span className="text-primary font-extrabold">BU Approval Queue</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
              Unit Staff Requests
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Review and approve transfer requests raised by unit staff before they proceed to
              Finance.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={toggleCurrency}
              disabled={rateFetching}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60"
            >
              {rateFetching ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowLeftRight className="w-3.5 h-3.5" />
              )}
              {rateFetching ? "Fetching rate…" : currency === "ZMW" ? "View in USD" : "View in ZMW"}
            </button>
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

        {/* Banners */}
        {success && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-850 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {rateError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{rateError}</span>
          </div>
        )}

        {/* KPI Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <ShieldAlert className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Active queue
              </span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Awaiting Your Approval
              </h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">
                {String(requests.length).padStart(2, "0")}
              </p>
            </div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wide">
              Requires your review
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-[#E6F4F1] rounded-lg">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] text-primary uppercase tracking-widest font-extrabold">
                Approved today
              </span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Forwarded to Finance
              </h3>
              <p className="text-3xl font-extrabold text-primary font-mono mt-1">
                {String(approvedToday).padStart(2, "0")}
              </p>
            </div>
            <div className="text-[10px] text-primary font-bold tracking-wide">
              Awaiting Finance sign-off
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                Outstanding
              </span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Pending Queue Value
              </h3>
              <p className="text-2xl font-extrabold text-[#029184] font-mono mt-1">
                {fmt(pendingValue)}
              </p>
            </div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wide">
              Accumulated pending value
            </div>
          </div>
        </section>

        {/* Main Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: queue list */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Filter bar */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-primary">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer Requests ({requests.length})</span>
              </div>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter queue…"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Queue list */}
            {loading ? (
              <div className="bg-white py-16 flex flex-col items-center justify-center text-slate-400 border border-slate-200 rounded-xl gap-2 shadow-sm">
                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
                <p className="text-xs font-extrabold font-mono uppercase tracking-wider">
                  Loading approval queue…
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white py-12 text-center text-slate-400 font-semibold text-xs border border-slate-200 rounded-xl uppercase tracking-wider shadow-sm">
                No requests awaiting your approval.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                      selectedItem?.id === item.id
                        ? "border-primary ring-1 ring-primary/20"
                        : "border-slate-200 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-primary font-mono text-sm">
                            {item.reference_number}
                          </span>
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Pending BU Approval
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap mt-0.5">
                          {item.unit_code && (
                            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                              {item.unit_code}
                            </span>
                          )}
                          {item.unit_name && <span>{item.unit_name}</span>}
                          {item.sbu_name && (
                            <span className="text-slate-400">· {item.sbu_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {item.items && (
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {item.items.length} line item{item.items.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-extrabold text-slate-700 font-mono">
                          {fmt(item.estimated_value ?? 0)}
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-300 group-hover:text-primary transition-colors ${
                            selectedItem?.id === item.id ? "text-primary" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: detail / action panel */}
          <div className="lg:sticky lg:top-6">
            {selectedItem ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-5 p-5">
                {/* Detail header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                      Transfer Request
                    </p>
                    <h2 className="font-extrabold text-primary font-mono text-base">
                      {selectedItem.reference_number}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata */}
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 flex flex-col gap-2 border border-slate-100">
                  {selectedItem.unit_name && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">Unit</span>
                      <span className="font-bold text-right">
                        {selectedItem.unit_code && (
                          <span className="font-mono bg-slate-200 text-slate-600 px-1 rounded mr-1 text-[10px]">
                            {selectedItem.unit_code}
                          </span>
                        )}
                        {selectedItem.unit_name}
                      </span>
                    </div>
                  )}
                  {selectedItem.sbu_name && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">SBU</span>
                      <span className="font-bold">{selectedItem.sbu_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">Submitted</span>
                    <span className="font-bold">
                      {new Date(selectedItem.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {selectedItem.required_date && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">Required By</span>
                      <span className="font-bold">
                        {new Date(selectedItem.required_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">Est. Value</span>
                    <span className="font-extrabold text-[#029184]">
                      {fmt(selectedItem.estimated_value ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Notes from requester */}
                {selectedItem.notes && (
                  <div className="text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="font-bold text-slate-500 mb-1 uppercase tracking-wider text-[10px]">
                      Requester Notes
                    </p>
                    <p className="leading-relaxed">{selectedItem.notes}</p>
                  </div>
                )}

                {/* Line Items */}
                {selectedItem.items && selectedItem.items.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Line Items ({selectedItem.items.length})
                    </p>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {selectedItem.items.map((item, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 text-xs"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-700 truncate">
                              {item.name}
                            </span>
                            {item.sku && (
                              <span className="font-mono text-slate-400 text-[10px]">
                                {item.sku}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="font-bold text-slate-700">×{item.quantity}</span>
                            {item.total != null && item.total > 0 && (
                              <span className="font-mono text-slate-400 text-[10px]">
                                {fmt(item.total)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approval notes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Your Notes (optional)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none bg-slate-50/50"
                    rows={3}
                    placeholder="Add remarks or reasons for your decision…"
                    value={notes[selectedItem.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [selectedItem.id]: e.target.value }))
                    }
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleAction(selectedItem.id, "reject")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(selectedItem.id, "approve")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Approve & Forward
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 flex flex-col items-center justify-center text-center gap-3 text-slate-400">
                <div className="p-3 bg-slate-50 rounded-full border border-slate-100">
                  <ShieldAlert className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-xs uppercase tracking-wider text-slate-500">
                    No request selected
                  </p>
                  <p className="text-xs mt-1">
                    Select a request from the queue to review details and take action.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
