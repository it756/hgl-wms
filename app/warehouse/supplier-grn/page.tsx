"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  Building,
  Calendar,
  Trash2,
  Plus,
  Info,
  ChevronDown,
  Search,
  AlertCircle,
  Scale,
  CheckCircle,
  FileSpreadsheet,
  TrendingUp,
  Hourglass,
  Percent,
  ShieldCheck,
  Truck,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeftRight,
  Edit2,
} from "lucide-react";

interface LineItem {
  product_id: string;
  product_name: string;
  sku: string;
  unit_of_measure: string;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit_of_measure: string;
  unit_cost: number | null;
}

interface SbuOption {
  id: string;
  name: string;
  code: string;
}

interface SupplierGRNRecord {
  id: string;
  reference_number: string;
  supplier_name: string;
  status: string;
  created_at: string;
  date_received: string;
  invoice_amount: number | null;
  supplier_invoice_reference: string | null;
  sbu_id: string | null;
  supplier_grn_line_items: { id: string }[];
}

function statusBadge(status: string) {
  switch (status) {
    case "AWAITING_FINANCE_APPROVAL":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "REJECTED":
      return "bg-rose-50 text-rose-700 border border-rose-200";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "AWAITING_FINANCE_APPROVAL":
      return "Awaiting Approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

export default function SupplierGRNPage() {
  const [view, setView] = useState<"list" | "form">("list");

  // List state
  const [grns, setGrns] = useState<SupplierGRNRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Edit state
  const [editingGrnId, setEditingGrnId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Form state
  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);
  const [sbuId, setSbuId] = useState("");
  const [sbus, setSbus] = useState<SbuOption[]>([]);

  const [lines, setLines] = useState<LineItem[]>([
    {
      product_id: "",
      product_name: "",
      sku: "",
      unit_of_measure: "EA",
      quantity_received: 1,
      unit_cost: 0.0,
      total_cost: 0.0,
    },
  ]);
  const [productSearch, setProductSearch] = useState<string[]>([""]);
  const [productOptions, setProductOptions] = useState<ProductOption[][]>([[]]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { currency, rate, fetching: rateFetching, rateError, toggleCurrency, fmt } = useCurrency();

  const token = () =>
    typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";

  const loadGrns = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/supplier-grns", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setGrns(await res.json());
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadGrns();
    // Load SBUs for the form dropdown
    fetch("/api/admin/sbus", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSbus)
      .catch(() => {});
  }, [loadGrns]);

  async function searchProducts(idx: number, query: string) {
    const searches = [...productSearch];
    searches[idx] = query;
    setProductSearch(searches);

    if (query.length < 1) {
      const opts = [...productOptions];
      opts[idx] = [];
      setProductOptions(opts);
      return;
    }

    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      const opts = [...productOptions];
      if (Array.isArray(data) && data.length > 0) {
        opts[idx] = data;
      } else {
        opts[idx] = [];
      }
      setProductOptions(opts);
    } catch {
      const opts = [...productOptions];
      opts[idx] = [];
      setProductOptions(opts);
    }
  }

  function selectProduct(idx: number, p: ProductOption) {
    const updated = [...lines];
    const initialUnitCost = p.unit_cost ?? 10.0;
    updated[idx] = {
      ...updated[idx],
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      unit_of_measure: p.unit_of_measure || "EA",
      unit_cost: initialUnitCost,
      total_cost: updated[idx].quantity_received * initialUnitCost,
    };
    setLines(updated);

    const searches = [...productSearch];
    searches[idx] = p.name;
    setProductSearch(searches);

    const opts = [...productOptions];
    opts[idx] = [];
    setProductOptions(opts);
  }

  function updateQuantity(idx: number, qty: number) {
    const updated = [...lines];
    updated[idx].quantity_received = qty;
    updated[idx].total_cost = qty * (updated[idx].unit_cost || 0);
    setLines(updated);
  }

  function updateUnitCost(idx: number, cost: number) {
    const updated = [...lines];
    updated[idx].unit_cost = cost;
    updated[idx].total_cost = updated[idx].quantity_received * cost;
    setLines(updated);
  }

  function addLine() {
    setLines([
      ...lines,
      {
        product_id: "",
        product_name: "",
        sku: "",
        unit_of_measure: "EA",
        quantity_received: 1,
        unit_cost: 0.0,
        total_cost: 0.0,
      },
    ]);
    setProductSearch([...productSearch, ""]);
    setProductOptions([...productOptions, []]);
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
    setProductSearch(productSearch.filter((_, i) => i !== idx));
    setProductOptions(productOptions.filter((_, i) => i !== idx));
  }

  async function startEdit(grnId: string) {
    setEditLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier-grns/${grnId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSupplier(data.supplier_name ?? "");
      setInvoiceRef(data.supplier_invoice_reference ?? "");
      setDateReceived(data.date_received ?? new Date().toISOString().split("T")[0]);
      setSbuId(data.sbu_id ?? "");
      const loadedLines: LineItem[] = (data.supplier_grn_line_items ?? []).map((li: any) => ({
        product_id: li.product_id,
        product_name: li.products?.name ?? "",
        sku: li.products?.sku ?? "",
        unit_of_measure: li.products?.unit_of_measure ?? "EA",
        quantity_received: li.quantity_received,
        unit_cost: li.unit_cost ?? 0,
        total_cost: li.quantity_received * (li.unit_cost ?? 0),
      }));
      setLines(loadedLines.length ? loadedLines : [{ product_id: "", product_name: "", sku: "", unit_of_measure: "EA", quantity_received: 1, unit_cost: 0, total_cost: 0 }]);
      setProductSearch(loadedLines.map((l) => l.product_name));
      setProductOptions(loadedLines.map(() => []));
      setEditingGrnId(grnId);
      setView("form");
    } catch (err: any) {
      setError(err.message || "Failed to load GRN for editing.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) {
      setError("Supplier name is required.");
      return;
    }
    if (lines.some((l) => !l.product_id)) {
      setError("All line items must have a product selected.");
      return;
    }
    setLoading(true);
    setError(null);
    const payload = {
      supplier_name: supplier,
      supplier_invoice_reference: invoiceRef || undefined,
      invoice_amount: totalVal > 0 ? totalVal : undefined,
      date_received: dateReceived,
      sbu_id: sbuId || undefined,
      items: lines.map((l) => ({
        product_id: l.product_id,
        quantity_received: l.quantity_received,
        unit_cost: l.unit_cost,
      })),
    };
    try {
      const isEdit = editingGrnId !== null;
      const res = await fetch(
        isEdit ? `/api/supplier-grns/${editingGrnId}` : "/api/supplier-grns",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(
        isEdit
          ? `Supplier GRN ${data.reference_number} updated successfully.`
          : `Supplier GRN ${data.reference_number} recorded successfully. Awaiting Finance approval.`,
      );
      resetForm();
      await loadGrns();
      setView("list");
    } catch (err: any) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingGrnId(null);
    setSupplier("");
    setInvoiceRef("");
    setSbuId("");
    setLines([
      {
        product_id: "",
        product_name: "",
        sku: "",
        unit_of_measure: "EA",
        quantity_received: 1,
        unit_cost: 0.0,
        total_cost: 0.0,
      },
    ]);
    setProductSearch([""]);
    setProductOptions([[]]);
  }

  const subtotal = lines.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
  const tax = 0.0;
  const totalVal = subtotal + tax;

  const awaitingCount = grns.filter((g) => g.status === "AWAITING_FINANCE_APPROVAL").length;
  const approvedCount = grns.filter((g) => g.status === "APPROVED").length;
  const rejectedCount = grns.filter((g) => g.status === "REJECTED").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-slate-800">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Inbound Logistics</span>
              <span className="text-slate-300">/</span>
              <span className="text-primary">
                {view === "list" ? "Supplier GRN Queue" : editingGrnId ? "Edit Supplier GRN" : "New Supplier GRN"}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] font-sans md:text-3xl">
              {view === "list" ? "Supplier GRN Queue" : editingGrnId ? "Edit Supplier GRN" : "Record Supplier GRN"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {view === "list"
                ? "All inbound supplier receipts submitted for Finance approval."
                : editingGrnId
                  ? "Update the details of this pending GRN before Finance reviews it."
                  : "Record a new supplier delivery and queue for Finance approval."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
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
              {view === "list" ? (
                <button
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setView("form");
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" /> New Supplier GRN
                </button>
              ) : (
                <button
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    resetForm();
                    setView("list");
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-sm transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Queue
                </button>
              )}
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

        {/* KPI Row — always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-primary transition">
            <div className="w-12 h-12 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-primary">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Total GRNs
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {loadingList ? "—" : grns.length}
              </h3>
              <p className="text-[10px] text-teal-700 font-black flex items-center gap-1 mt-1 uppercase">
                <TrendingUp className="w-3 h-3" /> All time
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-primary transition">
            <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Awaiting Approval
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {loadingList ? "—" : awaitingCount}
              </h3>
              <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-1 uppercase">
                <Hourglass className="w-3 h-3" /> Pending signoff
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-primary transition">
            <div className="w-12 h-12 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Approved
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {loadingList ? "—" : approvedCount}
              </h3>
              <p className="text-[10px] text-emerald-600 font-black flex items-center gap-1 mt-1 uppercase">
                🎯 Stock updated
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-primary transition">
            <div className="w-12 h-12 rounded-lg bg-[#E6F4F1] border border-teal-100 flex items-center justify-center text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                Rejected
              </p>
              <h3 className="font-extrabold text-[#1E293B] text-lg font-mono leading-none">
                {loadingList ? "—" : rejectedCount}
              </h3>
              <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1 uppercase">
                <XCircle className="w-3 h-3" /> Returned
              </p>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {success && (
          <div className="bg-[#E6F4F1] border border-teal-200 text-teal-850 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {rateError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{rateError}</span>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                All Supplier GRNs
              </h3>
              <button
                onClick={loadGrns}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            {loadingList ? (
              <div className="flex items-center justify-center py-16">
                <span className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
              </div>
            ) : grns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Truck className="w-10 h-10 opacity-30" />
                <p className="text-sm font-semibold">No supplier GRNs recorded yet.</p>
                <button
                  onClick={() => setView("form")}
                  className="mt-1 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition"
                >
                  Record First GRN
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3">Reference</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Date Received</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3 text-right">Invoice Value</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grns.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-3.5 font-mono font-extrabold text-primary">
                          {g.reference_number}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700">
                          {g.supplier_name}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {new Date(g.date_received).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {g.supplier_grn_line_items?.length ?? 0} line
                          {(g.supplier_grn_line_items?.length ?? 0) !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-800 text-right">
                          {fmt(g.invoice_amount)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusBadge(g.status)}`}
                          >
                            {statusLabel(g.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {g.status === "AWAITING_FINANCE_APPROVAL" && (
                            <button
                              onClick={() => startEdit(g.id)}
                              disabled={editLoading}
                              title="Edit GRN"
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── FORM VIEW ── */}
        {view === "form" && (
          <>
            {/* Financial Review Notice */}
            <div className="bg-orange-50 border border-orange-200 text-[#904D00] rounded-xl p-4 flex gap-3.5 items-start">
              <div className="p-1.5 bg-orange-100 rounded-lg shrink-0">
                <Info className="w-5 h-5 text-orange-700" />
              </div>
              <div>
                <h4 className="font-extrabold text-[12px] uppercase tracking-wide">
                  Financial Review Required
                </h4>
                <p className="text-[11px] font-medium leading-relaxed mt-1 opacity-90">
                  This GRN will be reviewed by the Finance Manager before stock levels are updated.
                  Ensure all invoice amounts and unit costs match the attached documentation.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* General Information Card */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    General Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Supplier Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Supplier Name
                    </label>
                    <input
                      required
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="e.g. Stark Industrial Ltd"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Invoice Reference */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Invoice Reference
                    </label>
                    <input
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      placeholder="e.g. INV-2026-0042"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  {/* Invoice Amount — auto-calculated from line items */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Invoice Amount (ZMW)
                    </label>
                    <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-700 font-bold flex items-center justify-between">
                      <span>{totalVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Auto</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Calculated from product line totals</p>
                  </div>

                  {/* Date Received */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Date Received
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={dateReceived}
                        onChange={(e) => setDateReceived(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* SBU Attribution — loaded from DB */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      SBU Attribution
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={sbuId}
                        onChange={(e) => setSbuId(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none appearance-none"
                      >
                        <option value="">— Select SBU (optional) —</option>
                        {sbus.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col gap-4 overflow-x-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 min-w-160">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Line Items
                  </h3>
                  <button
                    type="button"
                    onClick={addLine}
                    className="px-3 py-1.5 border border-primary text-primary hover:bg-primary/5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="overflow-visible">
                  <table className="w-full min-w-160 text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="py-3 px-3">Product Description</th>
                        <th className="py-3 px-3 w-28">UoM</th>
                        <th className="py-3 px-3 w-28 text-center">Qty Received</th>
                        <th className="py-3 px-3 w-32">Unit Cost (ZMW)</th>
                        <th className="py-3 px-3 w-32 text-right">Total ({currency})</th>
                        <th className="py-3 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20 relative">
                          <td className="py-3 px-3">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-350 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                required
                                value={productSearch[idx]}
                                onChange={(e) => searchProducts(idx, e.target.value)}
                                placeholder="Search product..."
                                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none placeholder:text-slate-350"
                              />
                            </div>
                            {productOptions[idx]?.length > 0 && (
                              <ul className="absolute left-0 right-0 z-100 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg text-xs max-h-48 overflow-y-auto divide-y divide-slate-50">
                                {productOptions[idx].map((p) => (
                                  <li
                                    key={p.id}
                                    onClick={() => selectProduct(idx, p)}
                                    className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer font-semibold text-slate-700 flex justify-between items-center"
                                  >
                                    <span>{p.name}</span>
                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {p.sku}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-500">
                            <select
                              value={line.unit_of_measure}
                              onChange={(e) => {
                                const u = [...lines];
                                u[idx].unit_of_measure = e.target.value;
                                setLines(u);
                              }}
                              className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 bg-white"
                            >
                              <option>EA</option>
                              <option>Rolls</option>
                              <option>Units</option>
                              <option>Meters</option>
                              <option>Boxes</option>
                            </select>
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              min="1"
                              required
                              value={line.quantity_received}
                              onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                              className="w-full border border-slate-200 rounded-lg p-1.5 font-bold font-mono text-center text-xs text-slate-700"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={line.unit_cost}
                              onChange={(e) => updateUnitCost(idx, Number(e.target.value))}
                              className="w-full border border-slate-200 rounded-lg p-1.5 font-bold font-mono text-xs text-slate-755"
                            />
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold font-mono text-slate-800 text-sm">
                            {fmt(line.total_cost)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals footer */}
                <div className="flex flex-col md:flex-row md:justify-between items-end gap-4 border-t border-slate-100 pt-5 mt-2">
                  <span className="text-slate-400 text-[10px] font-semibold max-w-sm">
                    Ensure physical item inspection is fully completed before submitting.
                  </span>
                  <div className="w-full max-w-xs flex flex-col gap-2.5 font-semibold text-xs text-slate-500">
                    <div className="flex justify-between items-center">
                      <span>Subtotal:</span>
                      <span className="font-bold text-slate-800 font-mono">{fmt(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Tax (0.0%):</span>
                      <span className="font-bold text-slate-800 font-mono">{fmt(tax)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200/80 pt-3 text-base">
                      <span className="font-extrabold text-slate-800">Total GRN Value:</span>
                      <span className="font-black text-primary font-mono text-lg">
                        {fmt(totalVal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex justify-between items-center bg-slate-50 border-t border-slate-100 -mx-6 -mb-6 p-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {loading ? (editingGrnId ? "Updating..." : "Submitting...") : editingGrnId ? "Update Supplier GRN" : "Submit Supplier GRN"}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
