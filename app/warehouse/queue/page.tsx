"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ClipboardList,
  Clock,
  User,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  Download,
  Activity,
  ArrowDown,
  FileText,
  Workflow,
  Paperclip,
} from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";

interface PendingRequest {
  id: string;
  reference_number: string;
  status: string;
  sbu_id: string;
  sbu_name?: string;
  required_date: string | null;
  created_at: string;
  estimated_value?: number;
  transfer_line_items: {
    product_id: string;
    requested_quantity: number;
    product_name?: string;
    sku?: string;
    stock_qty?: number;
    location?: string;
  }[];
}

interface IssuanceItem {
  product_id: string;
  product_name: string;
  sku: string;
  location: string;
  requested: number;
  stock: number;
  quantity_issued: number;
  shortfall_reason?: string;
  verified?: boolean;
}

const SHORTFALL_REASONS = [
  "Stock shortage - Remaining on backorder",
  "Damaged stock",
  "Expired stock",
  "Reserved for other orders",
  "Pending supplier delivery",
  "Other",
] as const;

export default function WarehouseQueuePage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<PendingRequest | null>(null);
  const [issuanceItems, setIssuanceItems] = useState<IssuanceItem[]>([]);
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [issuedRecord, setIssuedRecord] = useState<{
    issuanceId: string;
    referenceNumber: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "ALL" | "PENDING_APPROVAL" | "APPROVED_FOR_ISSUE" | "ISSUED_TODAY"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Logistics & Dispatch state
  const [courierName, setCourierName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [licenseVerified, setLicenseVerified] = useState(false);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  async function loadQueue() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/transfer-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const enriched = (data ?? []).map((r: any) => ({
        ...r,
        sbu_name: r.sbus?.name ?? r.sbu_id,
        estimated_value:
          r.estimated_value ??
          r.transfer_line_items?.reduce(
            (sum: number, i: any) => sum + i.requested_quantity * (i.products?.unit_cost ?? 0),
            0,
          ) ??
          0,
        transfer_line_items: (r.transfer_line_items ?? []).map((line: any) => ({
          ...line,
          product_name: line.products?.name ?? `Product ${line.product_id}`,
          sku: line.products?.sku ?? "",
          stock_qty: line.products?.stock_quantity ?? 0,
          location: line.products?.warehouse_location ?? "—",
        })),
      }));
      setRequests(enriched);
    } catch (err: any) {
      showError(err.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  function startIssuing(request: PendingRequest) {
    setIssuingId(request.id);
    setActiveRequest(request);
    setCourierName("");
    setVehiclePlate("");
    setLicenseVerified(false);

    setIssuanceItems(
      request.transfer_line_items.map((l) => {
        const stock = l.stock_qty ?? 100;
        const requested = l.requested_quantity;
        const initialQty = stock >= requested ? requested : stock;
        const shortfall = stock < requested;

        return {
          product_id: l.product_id,
          product_name: l.product_name || "Unknown Product",
          sku: l.sku || "SKU-UNKNOWN",
          location: l.location || "—",
          requested: requested,
          stock: stock,
          quantity_issued: initialQty,
          shortfall_reason: shortfall ? "Stock shortage - Remaining on backorder" : "N/A",
          verified: false,
        };
      }),
    );
    setLogisticsNotes("");
    setSuccessMsg(null);
    setError(null);
  }

  function cancelIssuing() {
    setIssuingId(null);
    setActiveRequest(null);
    setIssuanceItems([]);
    setCourierName("");
    setVehiclePlate("");
    setLicenseVerified(false);
  }

  // Helper inside functions
  function updateIssuanceQty(index: number, val: number) {
    setIssuanceItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const shortfall = item.stock < item.requested;
          const exceeds = val > item.stock;
          let reason = item.shortfall_reason;
          if (!shortfall && !exceeds) {
            reason = "N/A";
          } else if (exceeds) {
            reason = "";
          } else if (val < item.requested) {
            reason = "Stock shortage - Remaining on backorder";
          }
          return { ...item, quantity_issued: val, shortfall_reason: reason };
        }
        return item;
      }),
    );
  }

  function updateShortfallReason(index: number, val: string) {
    setIssuanceItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, shortfall_reason: val } : item)),
    );
  }

  function toggleVerifyItem(index: number) {
    setIssuanceItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, verified: !item.verified } : item)),
    );
  }

  const allVerified = issuanceItems.length > 0 && issuanceItems.every((item) => item.verified);
  const verifiedCount = issuanceItems.filter((item) => item.verified).length;

  async function submitIssuance() {
    if (!issuingId) return;

    const hasExceeds = issuanceItems.some((item) => item.quantity_issued > item.stock);
    if (hasExceeds) {
      showError("Please resolve exceeds stock error before proceeding.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const payloadItems = issuanceItems.map((item) => ({
        product_id: item.product_id,
        quantity_issued: item.quantity_issued,
        shortfall_reason: item.quantity_issued < item.requested ? item.shortfall_reason : undefined,
      }));

      const res = await fetch("/api/issuances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transfer_request_id: issuingId,
          items: payloadItems,
          logistics_notes: logisticsNotes.trim() || undefined,
        }),
      });
      const data = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error(data?.error || "Failed to record issuance");
      const issuanceId: string | null = data?.issuanceId ?? null;
      showSuccess(`Issuance recorded successfully for ${activeRequest?.reference_number}`);
      if (issuanceId) {
        setIssuedRecord({ issuanceId, referenceNumber: activeRequest?.reference_number ?? "" });
      }
      setIssuingId(null);
      setActiveRequest(null);
      setIssuanceItems([]);
      await loadQueue();
    } catch (err: any) {
      showError(err.message || "Failed to record issuance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "ASAP";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getStockStatus = (r: PendingRequest) => {
    let sufficient = true;
    r.transfer_line_items.forEach((item) => {
      if (item.stock_qty !== undefined && item.stock_qty < item.requested_quantity) {
        sufficient = false;
      }
    });
    if (!sufficient) return "SHORTFALL_RISK";
    return "FULL_STOCK";
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sbu_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.transfer_line_items.some(
        (l) =>
          l.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    if (!matchesSearch) return false;

    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING_APPROVAL")
      return (
        r.status === "PENDING" ||
        r.status === "AWAITING_FINANCE_APPROVAL" ||
        r.status === "PENDING_APPROVAL"
      );
    if (activeTab === "APPROVED_FOR_ISSUE")
      return r.status === "APPROVED_FOR_ISSUE" || r.status === "APPROVED";
    if (activeTab === "ISSUED_TODAY") return r.status === "ISSUED" || r.status === "COMPLETED";
    return true;
  });

  const kpis = {
    pendingApproval: requests.filter(
      (r) =>
        r.status === "PENDING" ||
        r.status === "AWAITING_FINANCE_APPROVAL" ||
        r.status === "PENDING_APPROVAL",
    ).length,
    approvedForIssue: requests.filter(
      (r) => r.status === "APPROVED_FOR_ISSUE" || r.status === "APPROVED",
    ).length,
    stockCritical: requests.filter((r) =>
      r.transfer_line_items.some((item) => (item.stock_qty || 0) < 20),
    ).length,
    issuedToday: requests
      .filter((r) => r.status === "ISSUED")
      .reduce(
        (sum, r) => sum + r.transfer_line_items.reduce((acc, l) => acc + l.requested_quantity, 0),
        0,
      ),
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Top Header Match high detail and Sidebar config */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Orders Dispatch</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#005c55] font-semibold">Outbound Warehouse Queue</span>
            </div>
            <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
              Issuance Queue
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Monitor and fulfill product release requests across all strategic business units.
            </p>
          </div>

          {issuingId ? (
            <button
              onClick={cancelIssuing}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 bg-white rounded-lg text-xs font-bold hover:bg-slate-50 shadow-sm transition"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" /> Back to Queue
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={loadQueue}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <Activity className="w-4 h-4 text-[#005c55]" />
                Refresh Registry
              </button>
              <button
                onClick={() => {
                  const dataStr =
                    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(requests));
                  const downloadAnchor = document.createElement("a");
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute(
                    "download",
                    `issuance_queue_manifest_${new Date().toISOString().split("T")[0]}.json`,
                  );
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Export Manifest
              </button>
            </div>
          )}
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-900 rounded-xl px-4 py-3.5 text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-in fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Post-issuance document upload panel */}
        {issuedRecord && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-[#eff4ff] flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                Attach Dispatch Documents
                <span className="font-mono text-primary">{issuedRecord.referenceNumber}</span>
              </h2>
              <button
                onClick={() => {
                  setIssuedRecord(null);
                  setSuccessMsg(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-200 rounded-lg transition"
              >
                Done
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 mb-4">
                Optionally attach the dispatch note, delivery note, or any supporting documents for
                this issuance.
              </p>
              <DocumentUpload
                transactionType="issuance"
                transactionId={issuedRecord.issuanceId}
                canDelete={false}
                token={
                  typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : ""
                }
              />
            </div>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3.5 text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-in fade-in duration-300">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!issuingId ? (
          <>
            {/* Dashboard Bento Micro-Cards Row matches screen perfectly */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-[#005c55]">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[#005c55]">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Pending Approval
                  </p>
                  <p className="text-xl font-extrabold text-[#0B1C30]">
                    {kpis.pendingApproval} Requests
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-[#005c55]">
                <div className="w-12 h-12 rounded-lg bg-[#EAEFFF] border border-blue-50 flex items-center justify-center text-blue-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Approved for Issue
                  </p>
                  <p className="text-xl font-extrabold text-[#0B1C30]">
                    {kpis.approvedForIssue} Orders
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-[#005c55]">
                <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Stock Critical
                  </p>
                  <p className="text-xl font-extrabold text-[#0B1C30]">
                    {kpis.stockCritical} Items
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#9CF2E8]/40 shadow-sm flex items-center gap-4 transition-all duration-300 hover:border-[#005c55]">
                <div className="w-12 h-12 rounded-lg bg-[#E6F4F1] border border-teal-50 flex items-center justify-center text-teal-700">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Issued Today
                  </p>
                  <p className="text-xl font-extrabold text-[#0B1C30]">{kpis.issuedToday} Packs</p>
                </div>
              </div>
            </div>

            {/* Micro layout container start */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mt-2">
              {/* Search & Tabs Header Bar */}
              <div className="p-4 border-b border-slate-150 bg-slate-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Tabs */}
                <div className="flex border-b border-transparent">
                  {(["ALL", "PENDING_APPROVAL", "APPROVED_FOR_ISSUE", "ISSUED_TODAY"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 pt-1 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 leading-none cursor-pointer ${
                          activeTab === tab
                            ? "border-[#005c55] text-[#005c55]"
                            : "border-transparent text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        {tab.replace("_", " ")}
                      </button>
                    ),
                  )}
                </div>

                {/* Autocomplete Quick Search */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Reference, SBU, parts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none placeholder:text-slate-350 bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#005c55]"></span>
                  <p className="text-xs font-bold font-mono tracking-wider">
                    REFRESHING ACTIVE LOGISTICS STREAM...
                  </p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <ClipboardList className="w-10 h-10 text-slate-300" />
                  <p className="font-bold text-xs uppercase tracking-wider font-mono">
                    No matching requests in this queue tab.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs font-medium mt-0.5">
                    Modify your filter state above or register a new outbound transfer request from
                    your manager profile.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Reference</th>
                        <th className="px-6 py-4">SBU / Dept</th>
                        <th className="px-6 py-4">Products</th>
                        <th className="px-6 py-4">Required by</th>
                        <th className="px-6 py-4 text-right">Est. Value</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Stock</th>
                        <th className="px-6 py-4 text-right pr-6 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRequests.map((r) => {
                        const stockStatus = getStockStatus(r);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="px-6 py-4. font-bold font-mono text-[#005c55] text-[13px] leading-none">
                              {r.reference_number}
                            </td>
                            <td className="px-6 py-4.5">
                              <p className="font-extrabold text-slate-800 text-xs leading-snug">
                                {r.sbu_name || r.sbu_id}
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Harvest Ops Node
                              </p>
                            </td>
                            <td className="px-6 py-4.5">
                              <p className="font-bold text-slate-700">
                                {r.transfer_line_items.length} items
                              </p>
                              <div className="flex gap-1 mt-1">
                                {r.transfer_line_items.slice(0, 2).map((item, i) => (
                                  <span
                                    key={i}
                                    className="bg-slate-100 text-[9px] font-mono text-slate-500 px-1 py-0.5 rounded"
                                  >
                                    {item.sku}
                                  </span>
                                ))}
                                {r.transfer_line_items.length > 2 && (
                                  <span className="bg-[#E6F4F1] text-[9px] font-mono text-teal-700 px-1 py-0.5 rounded">
                                    +{r.transfer_line_items.length - 2} more
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4.5 font-semibold text-slate-600">
                              {formatDate(r.required_date)}
                            </td>
                            <td className="px-6 py-4.5 font-bold font-mono text-right text-slate-700 pr-8">
                              ${r.estimated_value?.toLocaleString() || "0.00"}
                            </td>
                            <td className="px-6 py-4.5 text-center">
                              <span
                                className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full uppercase tracking-wider border ${
                                  r.status === "APPROVED_FOR_ISSUE" || r.status === "APPROVED"
                                    ? "text-blue-700 bg-blue-50 border-blue-100"
                                    : r.status === "PENDING"
                                      ? "text-slate-500 bg-slate-50 border-slate-200/60"
                                      : r.status === "AWAITING_FINANCE_APPROVAL"
                                        ? "text-amber-700 bg-amber-50 border-amber-100"
                                        : "text-indigo-700 bg-indigo-50 border-indigo-100"
                                }`}
                              >
                                {r.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4.5 text-center">
                              {stockStatus === "FULL_STOCK" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>{" "}
                                  Fully Stocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-750 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{" "}
                                  Shortfall Risk
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right pr-6">
                              {r.status === "APPROVED_FOR_ISSUE" || r.status === "APPROVED" ? (
                                <button
                                  onClick={() => startIssuing(r)}
                                  className="px-3.5 py-1.5 bg-[#005c55] hover:bg-[#004740] text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-sm leading-none"
                                >
                                  Issue Goods
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="px-3.5 py-1.5 bg-slate-105 text-slate-400 text-xs font-bold border border-slate-205 rounded-lg cursor-not-allowed leading-none"
                                >
                                  Awaiting Status
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* DETAILED ISSUANCE FORM SECTION matching Image 1 perfectly */
          activeRequest && (
            <div className="flex flex-col gap-6">
              {/* Strategic Business Unit Header Box */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                    Strategic Business Unit
                  </p>
                  <div className="flex gap-3 items-start">
                    <div className="p-3 bg-[#E6F4F1] text-teal-800 rounded-xl border border-teal-100 shrink-0">
                      <svg
                        className="w-6 h-6 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 text-sm leading-tight">
                        {activeRequest.sbu_name || activeRequest.sbu_id}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                        Warehouse Delivery Endpoint
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                    Requested Date
                  </p>
                  <p className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />{" "}
                    {formatDate(activeRequest.created_at)}
                  </p>
                </div>

                <div className="flex items-center justify-between md:border-l md:pl-6">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                      Required By
                    </p>
                    <p className="font-extrabold text-[#904D00] text-sm flex items-center gap-1.5">
                      <span className="text-amber-600 font-extrabold text-base leading-none">
                        !
                      </span>{" "}
                      {formatDate(activeRequest.required_date)}
                    </p>
                  </div>
                  <span className="bg-yellow-50 border border-yellow-100 text-yellow-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    Awaiting Dispatch
                  </span>
                </div>
              </div>

              {/* Modern Courier & Logistics Details Card */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col gap-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                    Courier &amp; Vehicle Verification
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                    Ensure security identity checks and transport details are recorded legally
                    before dispatch.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Manning Courier / Driver Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DHL Express / John Doe"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Vehicle Registration / Plate No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KCD 789X / T-0044"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold uppercase focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 md:mt-2">
                    <input
                      type="checkbox"
                      id="license_verified"
                      checked={licenseVerified}
                      onChange={(e) => setLicenseVerified(e.target.checked)}
                      className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded-md focus:ring-primary-500"
                    />
                    <label
                      htmlFor="license_verified"
                      className="text-xs font-extrabold text-slate-700 cursor-pointer select-none"
                    >
                      Driver License Checked &amp; Verified
                    </label>
                  </div>
                </div>
              </div>

              {/* Line Items Card Table */}
              <div className="bg-white border border-slate-200/90 shadow-sm rounded-xl overflow-hidden p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex flex-col flex-1 gap-2 pr-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">
                        Dispatch Verification &amp; Shortfall Controls
                      </h3>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          allVerified
                            ? "bg-teal-50 text-teal-700 border-teal-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {verifiedCount} / {issuanceItems.length} verified
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      Tick each item after physically picking and packing it. All items must be
                      verified before dispatch can be confirmed.
                    </p>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          allVerified ? "bg-teal-500" : "bg-amber-400"
                        }`}
                        style={{
                          width: issuanceItems.length
                            ? `${(verifiedCount / issuanceItems.length) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[11px] font-bold">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 8.293A1 1 0 013 7.586V4z"
                      />
                    </svg>
                    Filter items
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 pr-4 w-12 text-center">Verify</th>
                        <th className="pb-3 pr-4">Product / Description</th>
                        <th className="pb-3 px-4 font-mono">Sku ID</th>
                        <th className="pb-3 px-3 text-center">Location</th>
                        <th className="pb-3 px-4 text-center">Requested</th>
                        <th className="pb-3 px-4 text-center">Stock</th>
                        <th className="pb-3 px-4 text-left w-36">Issue Qty</th>
                        <th className="pb-3 pl-4 text-left">Shortfall Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {issuanceItems.map((item, idx) => {
                        const exceedsStock = item.quantity_issued > item.stock;
                        const isShortfallDetail = item.quantity_issued < item.requested;
                        const isVerified = item.verified;

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/30 transition ${
                              exceedsStock ? "bg-red-50/40" : isVerified ? "bg-teal-50/20" : ""
                            }`}
                          >
                            <td className="py-4 pr-4 text-center">
                              <input
                                type="checkbox"
                                checked={isVerified || false}
                                onChange={() => toggleVerifyItem(idx)}
                                className="w-4.5 h-4.5 text-primary border-slate-300 rounded focus:ring-primary focus:border-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-4 pr-4">
                              <div className="flex flex-col">
                                <p
                                  className={`font-extrabold text-slate-800 text-sm leading-snug flex items-center gap-1.5 ${isVerified ? "line-through text-slate-400 opacity-60" : ""}`}
                                >
                                  {item.product_name}
                                  {isVerified && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-teal-100 text-teal-850 px-1.5 py-0.5 rounded-full font-bold">
                                      ✔ Verified
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                  Grade-A Warehouse Inventory Stock
                                </p>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono font-medium text-slate-600">
                              {item.sku}
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className="inline-flex items-center justify-center w-9 h-6 rounded font-mono font-extrabold text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 tracking-wider">
                                {item.location}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-slate-600">
                              {item.requested}
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-slate-600">
                              {item.stock.toLocaleString()}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.quantity_issued || 0}
                                  onChange={(e) => updateIssuanceQty(idx, Number(e.target.value))}
                                  className={`w-28 px-3 py-1.5 border rounded-lg font-bold font-mono text-center focus:outline-none text-xs ${
                                    exceedsStock
                                      ? "border-red-500 text-red-600 bg-red-50 focus:ring-1 focus:ring-red-400"
                                      : "border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-primary focus:border-primary"
                                  }`}
                                />
                                {exceedsStock && (
                                  <span className="text-[9px] font-black text-red-500 tracking-wide uppercase">
                                    EXCEEDS STOCK
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 pl-4">
                              {item.stock >= item.requested && !exceedsStock ? (
                                <input
                                  type="text"
                                  disabled
                                  value="N/A"
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 font-semibold cursor-not-allowed"
                                />
                              ) : (
                                (() => {
                                  const raw = item.shortfall_reason ?? "";
                                  const isOther = raw.startsWith("Other:") || raw === "Other";
                                  const selected = isOther
                                    ? "Other"
                                    : SHORTFALL_REASONS.includes(raw as any)
                                      ? raw
                                      : "Stock shortage - Remaining on backorder";
                                  const otherDetail = raw.startsWith("Other:")
                                    ? raw.slice(6).trimStart()
                                    : "";
                                  return (
                                    <div className="flex flex-col gap-1.5">
                                      <select
                                        value={selected}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          updateShortfallReason(idx, v === "Other" ? "Other: " : v);
                                        }}
                                        className={`w-full px-3 py-1.5 border rounded-lg font-semibold text-xs focus:outline-none ${
                                          exceedsStock
                                            ? "border-red-300 text-red-800 bg-red-50/50"
                                            : isShortfallDetail
                                              ? "border-orange-300 text-[#904D00] bg-orange-50/40"
                                              : "border-slate-200 focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                                        }`}
                                      >
                                        {SHORTFALL_REASONS.map((r) => (
                                          <option key={r} value={r}>
                                            {r}
                                          </option>
                                        ))}
                                      </select>
                                      {selected === "Other" && (
                                        <input
                                          type="text"
                                          value={otherDetail}
                                          onChange={(e) =>
                                            updateShortfallReason(idx, `Other: ${e.target.value}`)
                                          }
                                          placeholder="Specify reason…"
                                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-semibold placeholder:text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                      )}
                                    </div>
                                  );
                                })()
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Shortfall Warnings Banner */}
                {issuanceItems.some((item) => item.quantity_issued < item.requested) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs text-amber-850 mt-1">
                    <svg
                      className="w-5 h-5 text-amber-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="font-extrabold">Active Item-Level Shortfall Warning</p>
                      <p className="mt-0.5 text-[11px] text-amber-700 font-medium">
                        One or more line items have issued quantities below the initial SBU
                        requested levels. Shortfall reasons must be recorded for auditing and
                        automated order split resolution.
                      </p>
                    </div>
                  </div>
                )}

                {/* Remarks TextArea */}
                <div className="mt-2 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Issuance Remarks &amp; Dispatch Notes
                  </label>
                  <textarea
                    value={logisticsNotes}
                    onChange={(e) => setLogisticsNotes(e.target.value)}
                    onFocus={() => {
                      if (
                        logisticsNotes ===
                        "Specify any special handling instructions or vehicle details for the dispatch team..."
                      ) {
                        setLogisticsNotes("");
                      }
                    }}
                    onBlur={() => {
                      if (logisticsNotes.trim() === "") {
                        setLogisticsNotes(
                          "Specify any special handling instructions or vehicle details for the dispatch team...",
                        );
                      }
                    }}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs placeholder:text-slate-350 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium"
                  />
                </div>

                {/* Bottom Card Buttons */}
                <div className="flex justify-between items-center bg-slate-50 border-t border-slate-100 -mx-6 -mb-6 p-4 mt-4">
                  <button
                    onClick={cancelIssuing}
                    className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cancel Request
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    {!allVerified && (
                      <p className="text-[10px] text-amber-600 font-bold">
                        Tick all {issuanceItems.length} items to enable dispatch
                      </p>
                    )}
                    <button
                      onClick={submitIssuance}
                      disabled={submitting || !allVerified}
                      title={
                        !allVerified
                          ? "Tick off all line items before confirming dispatch"
                          : undefined
                      }
                      className="px-4 py-2 bg-primary hover:bg-[#004740] rounded-lg text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {submitting ? "Submitting..." : "Confirm & Dispatch"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
