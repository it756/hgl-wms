"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Check,
  X,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Search,
  ArrowRightLeft,
  Calendar,
  Building,
  ChevronRight,
  Layers,
  TrendingDown,
  RefreshCw,
  ArrowLeftRight,
  Paperclip,
} from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";

interface PendingItem {
  id: string;
  reference_number: string;
  status: string;
  estimated_value?: number;
  invoice_amount?: number;
  supplier_name?: string;
  created_at: string;
  sbu_name?: string;
  requester_name?: string;
  items?: Array<{
    name: string;
    sku: string;
    quantity: number;
    unit_cost?: number;
    total?: number;
  }>;
}

export default function FinanceQueuePage() {
  const [transfers, setTransfers] = useState<PendingItem[]>([]);
  const [supplierGrns, setSupplierGrns] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [activeTab, setActiveTab] = useState<"transfers" | "grns">("transfers");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvedToday, setApprovedToday] = useState(0);
  const [rejectedToday, setRejectedToday] = useState(0);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch("/api/finance/approvals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        const normalizedTransfers = (data.transfer_requests ?? []).map((t: any) => ({
          ...t,
          sbu_name: t.sbus?.name ?? t.sbu_id,
          requester_name: t.requester_name ?? null,
          items: (t.transfer_line_items ?? []).map((l: any) => ({
            name: l.products?.name ?? `Product ${l.product_id}`,
            sku: l.products?.sku ?? "",
            quantity: l.requested_quantity,
            unit_cost: l.products?.unit_cost ?? null,
            total: l.requested_quantity * (l.products?.unit_cost ?? 0),
          })),
        }));
        const normalizedGrns = (data.supplier_grns ?? []).map((g: any) => ({
          ...g,
          items: (g.supplier_grn_line_items ?? []).map((l: any) => ({
            name: l.products?.name ?? `Product ${l.product_id}`,
            sku: l.products?.sku ?? "",
            quantity: l.quantity_received,
            unit_cost: l.unit_cost ?? null,
            total: l.quantity_received * (l.unit_cost ?? 0),
          })),
        }));
        setTransfers(normalizedTransfers);
        setSupplierGrns(normalizedGrns);
        setApprovedToday(data.approved_today ?? 0);
        setRejectedToday(data.rejected_today ?? 0);
      } else {
        throw new Error(data.error || "Failed to load approvals queue");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load approvals queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleAction(
    entityType: "transfer_request" | "supplier_grn",
    entityId: string,
    action: "approve" | "reject",
  ) {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch("/api/finance/approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          action,
          notes: notes[entityId] ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setSuccess(
        `${entityType === "transfer_request" ? "Transfer Request" : "Supplier GRN"} ${action === "approve" ? "approved" : "rejected"} successfully.`,
      );
      setNotes((prev) => {
        const copy = { ...prev };
        delete copy[entityId];
        return copy;
      });
      setSelectedItem(null);
      await loadQueue();
    } catch (err: any) {
      setError(err.message || "Action failed. Please try again.");
    }
  }

  function setNoteForItem(id: string, val: string) {
    setNotes((prev) => ({ ...prev, [id]: val }));
  }

  const filteredTransfers = transfers.filter(
    (t) =>
      t.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requester_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sbu_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredGRNs = supplierGrns.filter(
    (g) =>
      g.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.sbu_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPending = transfers.length + supplierGrns.length;
  const pendingValue =
    transfers.reduce((sum, t) => sum + (t.estimated_value || 0), 0) +
    supplierGrns.reduce((sum, g) => sum + (g.invoice_amount || 0), 0);
  const { currency, rate, fetching: rateFetching, rateError, toggleCurrency, fmt } = useCurrency();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-850">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Corporate Control</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#005c55] font-extrabold">Finance Approvals</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
              Financial Control Queue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Verify internal corporate stock allocations and sign off on high-value supplier
              invoices.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
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

        {/* Global Banner Log Notifications */}
        {success && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-850 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-650 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {rateError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{rateError}</span>
          </div>
        )}

        {/* Stats KPI Widgets Block */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Pending */}
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
                Awaiting Approval
              </h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">
                {String(totalPending).padStart(2, "0")}
              </p>
            </div>
            <div className="text-[10px] text-slate-405 font-bold tracking-wide">
              Requires immediate action
            </div>
          </div>

          {/* Card 2: Approved */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-[#E6F4F1] rounded-lg">
                <Check className="w-5 h-5 text-[#005c55]" />
              </div>
              <span className="text-[10px] text-[#005c55] uppercase tracking-widest font-sans font-extrabold">
                Approved today
              </span>
            </div>
            <div>
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Completed Today
              </h3>
              <p className="text-3xl font-extrabold text-[#005c55] font-mono mt-1">
                {String(approvedToday).padStart(2, "0")}
              </p>
            </div>
            <div className="text-[10px] text-[#005c55] font-bold tracking-wide">
              Approved & synced
            </div>
          </div>

          {/* Card 3: Rejected */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-50/50 rounded-lg border border-rose-50">
                <X className="w-5 h-5 text-rose-600" />
              </div>
              <span className="text-[10px] text-[#E11D48] uppercase tracking-widest font-sans font-extrabold">
                Rejected today
              </span>
            </div>
            <div>
              <h3 className="text-slate-505 text-xs font-bold uppercase tracking-wider">
                Rejected
              </h3>
              <p className="text-3xl font-extrabold text-slate-800 font-mono mt-1">
                {String(rejectedToday).padStart(2, "0")}
              </p>
            </div>
            <div className="text-[10px] text-[#E11D48] font-bold tracking-wide">
              Requires detailed review
            </div>
          </div>

          {/* Card 4: Outstanding Value */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-50">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                Outstanding liabilities
              </span>
            </div>
            <div>
              <h3 className="text-slate-550 text-xs font-bold uppercase tracking-wider">
                Pending Value
              </h3>
              <p className="text-2xl font-extrabold text-[#029184] font-mono mt-1">
                {fmt(pendingValue)}
              </p>
            </div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wide">
              Accumulated queue valuation
            </div>
          </div>
        </section>

        {/* Tab Selection, Filter Search & Main Split Grid View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Action Queue Sidebar List */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Control Filtering Subheader Card */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Tabs Switcher */}
              <div className="flex border-b sm:border-b-0 border-slate-100 p-0.5 bg-slate-50/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("transfers");
                    setSelectedItem(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === "transfers"
                      ? "bg-white text-[#005c55] shadow-sm font-extrabold"
                      : "text-slate-450 hover:text-slate-700"
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Transfer requests ({transfers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("grns");
                    setSelectedItem(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === "grns"
                      ? "bg-[#005c55] text-white shadow-sm font-extrabold"
                      : "text-[#005c55] hover:text-[#004740]"
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Supplier GRNs ({supplierGrns.length})</span>
                </button>
              </div>

              {/* Dynamic Filtering Input */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter active queue..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* List queue area loaded or fallback */}
            {loading ? (
              <div className="bg-white py-16 flex flex-col items-center justify-center text-slate-400 border border-slate-200 rounded-xl gap-2 shadow-sm">
                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
                <p className="text-xs font-extrabold font-mono uppercase tracking-wider">
                  Refreshing ledger approvals queue...
                </p>
              </div>
            ) : activeTab === "transfers" ? (
              /* INTERNAL TRANSFER REQUESTS PANEL LIST */
              <div className="flex flex-col gap-4">
                {filteredTransfers.length === 0 ? (
                  <div className="bg-white py-12 text-center text-slate-400 font-semibold text-xs border border-slate-150 rounded-xl uppercase tracking-wider shadow-sm">
                    No active internal transfer approvals pending review.
                  </div>
                ) : (
                  filteredTransfers.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedItem(t)}
                      className={`border bg-white rounded-xl p-5 shadow-sm hover:border-[#005c55]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer relative ${
                        selectedItem?.id === t.id
                          ? "border-[#005c55] ring-1 ring-[#005c55]/25 bg-slate-50/20"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-teal-50 rounded-lg text-[#005c55] mt-1 shrink-0">
                          <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 font-mono text-sm tracking-tight">
                              {t.reference_number}
                            </span>
                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-orange-100/70 border border-orange-200 text-orange-850 rounded-full font-sans">
                              Verification Phase
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                            <Layers className="w-3 h-3" /> {t.sbu_name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 font-sans">
                            Requested by{" "}
                            <strong className="text-slate-700">{t.requester_name ?? "—"}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                          Est. Allocation Value
                        </span>
                        <span className="text-base font-black font-mono text-slate-800">
                          {fmt(t.estimated_value)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-450 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{" "}
                          {new Date(t.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <span className="absolute right-3 top-3 text-slate-350 opacity-45">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* SUPPLIER GRNS PANEL LIST */
              <div className="flex flex-col gap-4">
                {filteredGRNs.length === 0 ? (
                  <div className="bg-white py-12 text-center text-slate-400 font-semibold text-xs border border-slate-150 rounded-xl uppercase tracking-wider shadow-sm">
                    No supplier GRNs pending verification logs.
                  </div>
                ) : (
                  filteredGRNs.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedItem(g)}
                      className={`border bg-white rounded-xl p-5 shadow-sm hover:border-[#005c55]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer relative ${
                        selectedItem?.id === g.id
                          ? "border-[#005c55] ring-1 ring-[#005c55]/25 bg-slate-50/20"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-orange-50 rounded-lg text-orange-600 mt-1 shrink-0">
                          <Building className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 font-mono text-sm tracking-tight">
                              {g.reference_number}
                            </span>
                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-orange-100/70 border border-orange-200 text-orange-850 rounded-full font-sans">
                              invoice matching
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {g.supplier_name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 font-sans">
                            Subscribed to <strong className="text-slate-700">{g.sbu_name}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                          Invoice Sum
                        </span>
                        <span className="text-base font-black font-mono text-[#005c55]">
                          {fmt(g.invoice_amount)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-450 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {g.created_at}
                        </span>
                      </div>

                      <span className="absolute right-3 top-3 text-slate-350 opacity-45">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Detailed Sidebar Drawer Action Form */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 lg:sticky top-6 flex flex-col gap-4">
            {!selectedItem ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-450 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                  No Item Selected
                </h4>
                <p className="text-slate-400 text-xs font-medium max-w-[200px] leading-relaxed">
                  Select an approval task from the list to view its line-item specifications and
                  sign off.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Drawer Summary header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div>
                    <span className="text-slate-450 uppercase text-[9px] font-extrabold tracking-widest">
                      Detail Summary
                    </span>
                    <h3 className="font-black font-mono text-slate-800 text-lg leading-tight mt-0.5">
                      {selectedItem.reference_number}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold font-sans transition"
                  >
                    Close ×
                  </button>
                </div>

                {/* Sub Metadata Account Box Info */}
                <div className="bg-slate-50 p-3.5 rounded-lg flex flex-col gap-2 border border-slate-100 text-xs font-semibold text-slate-500">
                  <div className="flex justify-between">
                    <span>Source/Supplier:</span>
                    <span className="text-slate-800 font-bold">
                      {selectedItem.supplier_name || selectedItem.requester_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date Filed:</span>
                    <span className="text-slate-800 font-mono font-bold">
                      {selectedItem.created_at}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Account SBU:</span>
                    <span className="text-slate-805 font-bold">{selectedItem.sbu_name}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200/50 pt-2.5 mt-1">
                    <span className="text-slate-705 font-semibold">Financial Value:</span>
                    <span className="text-base font-black font-mono text-slate-800">
                      {fmt(selectedItem.estimated_value ?? selectedItem.invoice_amount)}
                    </span>
                  </div>
                </div>

                {/* Inspected Line items list */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Inspected Items Ledger
                  </h4>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-150 rounded-lg px-3 bg-white">
                    {selectedItem.items?.map((it, i) => (
                      <div
                        key={i}
                        className="py-2.5 flex justify-between gap-4 text-xs font-medium"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-750 font-bold leading-tight">{it.name}</span>
                          <span className="font-mono text-[9px] text-slate-400">{it.sku}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-800 font-mono">
                            Qty {it.quantity}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {fmt(it.unit_cost)} ea
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attached documents (read-only — only shown for supplier GRNs) */}
                {activeTab === "grns" && (
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3" /> Attached Documents
                    </h4>
                    <div className="border border-slate-100 rounded-lg px-3 py-2 bg-slate-50">
                      <DocumentUpload
                        transactionType="supplier_grn"
                        transactionId={selectedItem.id}
                        canDelete={false}
                        readOnly={true}
                        token={
                          typeof window !== "undefined"
                            ? (localStorage.getItem("access_token") ?? "")
                            : ""
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Verification Resolution input box */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                    Verify Approver Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide detailed approval / rejection context (optional)..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] transition-all"
                    value={notes[selectedItem.id] ?? ""}
                    onChange={(e) => setNoteForItem(selectedItem.id, e.target.value)}
                  />
                </div>

                {/* Split Action Trigger items */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() =>
                      handleAction(
                        activeTab === "transfers" ? "transfer_request" : "supplier_grn",
                        selectedItem.id,
                        "reject",
                      )
                    }
                    className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold rounded-lg transition uppercase tracking-wide cursor-pointer text-center"
                  >
                    Reject Audit
                  </button>
                  <button
                    onClick={() =>
                      handleAction(
                        activeTab === "transfers" ? "transfer_request" : "supplier_grn",
                        selectedItem.id,
                        "approve",
                      )
                    }
                    className="py-2 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-extrabold rounded-lg transition uppercase tracking-wide cursor-pointer text-center"
                  >
                    Sign & Release
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
