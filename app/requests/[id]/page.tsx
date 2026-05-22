"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useCurrency } from "@/lib/hooks/useCurrency";
import {
  ArrowLeft,
  Package,
  Calendar,
  Hash,
  FileText,
  DollarSign,
  ArrowLeftRight,
  RefreshCw,
  Pencil,
} from "lucide-react";

const EDITABLE_STATUSES = ["PENDING", "PENDING_APPROVAL", "PENDING_BU_APPROVAL"];

interface Product {
  id: string;
  name: string;
  sku: string;
  unit_of_measure: string;
  unit_cost: number | null;
}

interface LineItem {
  id: string;
  product_id: string;
  requested_quantity: number;
  products: Product | null;
}

interface SBU {
  id: string;
  name: string;
}

interface SBUUnit {
  id: string;
  name: string;
  code: string;
}

interface TransferRequest {
  id: string;
  reference_number: string;
  status: string;
  required_date: string | null;
  notes: string | null;
  estimated_value: number | null;
  requires_finance_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  finance_approval_notes: string | null;
  created_at: string;
  updated_at: string;
  sbus: SBU | null;
  sbu_units: SBUUnit | null;
  transfer_line_items: LineItem[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-500 border border-slate-200",
  PENDING_APPROVAL: "bg-orange-50 text-orange-700 border border-orange-200",
  APPROVED_FOR_ISSUE: "bg-blue-50 text-sky-700 border border-blue-200",
  ISSUED: "bg-purple-50 text-purple-700 border border-purple-200",
  COMPLETED: "bg-teal-50 text-emerald-700 border border-teal-200",
  COMPLETED_WITH_VARIANCE: "bg-red-50 text-rose-700 border border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-400 border border-slate-200",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}

export default function TransferRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<TransferRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function fetchRequest() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`/api/transfer-requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load request");
        setRequest(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRequest();
  }, [id]);
  const { currency, rate, fetching: rateFetching, rateError, toggleCurrency, fmt } = useCurrency();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Breadcrumb + Back */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Workspace</span>
              <span>/</span>
              <Link href="/requests" className="hover:text-primary transition-colors">
                Transfer Requests
              </Link>
              <span>/</span>
              <span className="text-primary font-bold">
                {request?.reference_number ?? "Details"}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-on-surface">
              {request?.reference_number ?? "Transfer Request"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              View details and line items for this transfer request.
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
              {request && EDITABLE_STATUSES.includes(request.status) && (
                <Link
                  href={`/requests/${request.id}/edit`}
                  className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Link>
              )}
              <Link
                href="/requests"
                className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
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

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></span>
            <p className="text-xs font-bold font-mono">LOADING...</p>
          </div>
        ) : request ? (
          <>
            {/* Summary Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Request Summary
                </h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[request.status] ?? "bg-slate-100 text-slate-600 border border-slate-200"}`}
                  >
                    {request.status.replace(/_/g, " ")}
                  </span>
                  {request.requires_finance_approval && (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      Finance Approval Required
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                <InfoRow
                  label="Reference"
                  value={<span className="font-mono text-primary">{request.reference_number}</span>}
                />
                <InfoRow label="SBU" value={request.sbus?.name ?? "—"} />
                <InfoRow
                  label="Requesting Unit"
                  value={
                    request.sbu_units
                      ? `${request.sbu_units.name} (${request.sbu_units.code})`
                      : "—"
                  }
                />
                <InfoRow
                  label="Required Date"
                  value={
                    request.required_date
                      ? new Date(request.required_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"
                  }
                />
                <InfoRow
                  label="Est. Value"
                  value={request.estimated_value != null ? fmt(request.estimated_value) : "—"}
                />
                <InfoRow
                  label="Date Raised"
                  value={new Date(request.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                />
                <InfoRow
                  label="Last Updated"
                  value={new Date(request.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                />
                {request.approved_at && (
                  <InfoRow
                    label="Approved On"
                    value={new Date(request.approved_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  />
                )}
              </div>

              {request.notes && (
                <div className="mt-5 pt-5 border-t border-outline-variant">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Notes
                  </span>
                  <p className="text-sm text-slate-600">{request.notes}</p>
                </div>
              )}

              {request.finance_approval_notes && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">
                    Finance Notes
                  </span>
                  <p className="text-sm text-amber-800">{request.finance_approval_notes}</p>
                </div>
              )}
            </div>

            {/* Line Items Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant bg-[#eff4ff]">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Line Items
                  <span className="ml-1 bg-primary/10 text-primary text-xs font-bold rounded-full px-2 py-0.5">
                    {request.transfer_line_items.length}
                  </span>
                </h2>
              </div>

              {request.transfer_line_items.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm font-semibold">
                  No line items found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-slate-50 border-b border-outline-variant">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          UOM
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                          Qty Requested
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                          Unit Cost
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                          Line Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {request.transfer_line_items.map((item, idx) => {
                        const lineTotal =
                          item.products?.unit_cost != null
                            ? item.products.unit_cost * item.requested_quantity
                            : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 text-xs text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                              {item.products?.name ?? (
                                <span className="text-slate-400 italic">Unknown product</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-xs font-mono text-slate-500">
                              {item.products?.sku ?? "—"}
                            </td>
                            <td className="px-6 py-3 text-xs text-slate-500">
                              {item.products?.unit_of_measure ?? "—"}
                            </td>
                            <td className="px-6 py-3 text-sm font-bold text-slate-700 text-right font-mono">
                              {item.requested_quantity.toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-sm text-slate-500 text-right font-mono">
                              {item.products?.unit_cost != null
                                ? fmt(item.products.unit_cost)
                                : "—"}
                            </td>
                            <td className="px-6 py-3 text-sm font-bold text-slate-700 text-right font-mono">
                              {lineTotal != null ? fmt(lineTotal) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {request.estimated_value != null && (
                      <tfoot className="border-t-2 border-outline-variant bg-slate-50">
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right"
                          >
                            Total Est. Value
                          </td>
                          <td className="px-6 py-3 text-sm font-extrabold text-primary text-right font-mono">
                            {fmt(request.estimated_value)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
