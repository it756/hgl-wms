"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  FileText,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface LineItem {
  id: string;
  product_name: string;
  sku: string | null;
  quantity_requested: number;
  unit_of_measure: string;
  unit_cost: number | null;
  notes: string | null;
}

interface PurchaseRequest {
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_PROCUREMENT_APPROVAL: "Pending Procurement",
  PROCUREMENT_CHANGES_REQUESTED: "Changes Requested by Procurement",
  PENDING_INTERNAL_CONTROL_APPROVAL: "Pending Internal Control",
  INTERNAL_CONTROL_CHANGES_REQUESTED: "Changes Requested by Control",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-500",
  PENDING_PROCUREMENT_APPROVAL: "bg-amber-100 text-amber-600",
  PROCUREMENT_CHANGES_REQUESTED: "bg-rose-100 text-rose-600",
  PENDING_INTERNAL_CONTROL_APPROVAL: "bg-amber-100 text-amber-600",
  INTERNAL_CONTROL_CHANGES_REQUESTED: "bg-rose-100 text-rose-600",
  APPROVED: "bg-emerald-100 text-emerald-600",
  REJECTED: "bg-rose-100 text-rose-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default function PurchaseRequestDetailsPage({ params }: { params: { id: string } }) {
  const [pr, setPr] = useState<PurchaseRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPurchaseRequest() {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select(
          `
          id, reference_number, status, supplier_name, notes, estimated_total, created_at,
          sbus(name, code),
          purchase_request_line_items(id, product_name, sku, quantity_requested, unit_of_measure, unit_cost, notes),
          procurement_action, procurement_actioned_at, procurement_notes, procurement_document_url,
          internal_control_action, internal_control_actioned_at, internal_control_notes
        `,
        )
        .eq("id", params.id)
        .single();

      if (error || !data) {
        notFound();
      } else {
        setPr(data as PurchaseRequest);
      }
      setLoading(false);
    }

    fetchPurchaseRequest();
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-20 bg-slate-200 rounded"></div>
            <div className="h-40 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!pr) {
    return null; // Should be handled by notFound()
  }

  const renderReviewCard = (
    title: string,
    action: string | null,
    actionedAt: string | null,
    notes: string | null,
    docUrl: string | null,
  ) => {
    if (!action) return null;

    let icon = <AlertCircle className="w-5 h-5 text-slate-500" />;
    let color = "slate";
    if (action.includes("APPROVE")) {
      icon = <CheckCircle className="w-5 h-5 text-emerald-500" />;
      color = "emerald";
    } else if (action.includes("REJECT")) {
      icon = <XCircle className="w-5 h-5 text-rose-500" />;
      color = "rose";
    } else if (action.includes("CHANGES")) {
      icon = <Clock className="w-5 h-5 text-amber-500" />;
      color = "amber";
    }

    return (
      <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
        <h3 className={`font-semibold text-md text-${color}-800 mb-2`}>{title}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {icon}
            <span className={`font-medium text-${color}-700`}>
              {action.replace(/_/g, " ")}
              {actionedAt && ` on ${new Date(actionedAt).toLocaleString()}`}
            </span>
          </div>
          {notes && <p className={`text-${color}-600 pl-7`}>Notes: {notes}</p>}
          {docUrl && /^https?:\/\//i.test(docUrl) && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-${color}-700 hover:underline font-medium pl-7`}
            >
              <FileText className="w-3.5 h-3.5" />
              View Supporting Document
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/purchase-requests"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Purchase Requests
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">
            Purchase Request{" "}
            <span className="font-mono text-slate-500">{pr.reference_number}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Created on {new Date(pr.created_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[pr.status] ?? "bg-slate-100 text-slate-500"}`}
        >
          {STATUS_LABELS[pr.status] ?? pr.status}
        </span>
      </div>

      {/* Main Details */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <label className="font-semibold text-slate-600">SBU</label>
          <p className="text-slate-800">{pr.sbus?.name ?? "—"}</p>
        </div>
        <div>
          <label className="font-semibold text-slate-600">Supplier</label>
          <p className="text-slate-800">{pr.supplier_name ?? "—"}</p>
        </div>
        <div>
          <label className="font-semibold text-slate-600">Estimated Total</label>
          <p className="text-slate-800 font-medium">
            {pr.estimated_total != null
              ? `ZMW ${pr.estimated_total.toLocaleString()}`
              : "—"}
          </p>
        </div>
        {pr.notes && (
          <div className="md:col-span-3">
            <label className="font-semibold text-slate-600">Notes</label>
            <p className="text-slate-800 whitespace-pre-wrap">{pr.notes}</p>
          </div>
        )}
      </div>

      {/* Review Stages */}
      <div className="space-y-4">
        {renderReviewCard(
          "Procurement Review",
          pr.procurement_action,
          pr.procurement_actioned_at,
          pr.procurement_notes,
          pr.procurement_document_url,
        )}
        {renderReviewCard(
          "Internal Control Review",
          pr.internal_control_action,
          pr.internal_control_actioned_at,
          pr.internal_control_notes,
          null, // No document for internal control
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <h3 className="text-md font-semibold text-slate-700 p-4 border-b border-slate-200">
          Requested Items ({pr.purchase_request_line_items.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-center">Qty</th>
                <th className="px-4 py-2 text-right">Unit Cost</th>
                <th className="px-4 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pr.purchase_request_line_items.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{l.product_name}</div>
                    {l.sku && <div className="text-slate-500 text-xs">SKU: {l.sku}</div>}
                    {l.notes && <div className="text-slate-500 text-xs italic mt-1">Note: {l.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {l.quantity_requested} {l.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {l.unit_cost != null ? `ZMW ${l.unit_cost.toLocaleString()}` : "—"}
                  </td>

                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {l.unit_cost != null
                      ? `ZMW ${(l.unit_cost * l.quantity_requested).toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
